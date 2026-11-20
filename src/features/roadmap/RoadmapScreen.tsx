import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowInstance,
} from '@xyflow/react';
import { Download, Maximize2, Search } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { BottomSheet } from '../../components/BottomSheet';
import { ProgressRing } from '../../components/ProgressRing';
import { Course, QueueId, Topic } from '../../types/masar';
import { getT } from '../../utils/i18n';
import { getCourseProgress } from '../../utils/planner';

type RoadmapMode = 'today' | 'all' | 'focus' | 'search';

interface MasarNodeData extends Record<string, unknown> {
  label: string;
  sublabel?: string;
  kind: 'root' | 'queue' | 'course' | 'topic' | 'item';
  status: 'completed' | 'current' | 'upcoming' | 'locked';
  progressPercent?: number;
  courseId?: string;
  topicId?: string;
  itemId?: string;
  queueId?: QueueId;
  prerequisites?: string[];
}

const MasarNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as MasarNodeData;
  const statusStyles =
    d.status === 'completed'
      ? 'border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.22)]'
      : d.status === 'current'
        ? 'border-cyan-400 bg-cyan-500/15 ring-2 ring-cyan-400/40'
        : d.status === 'locked'
          ? 'border-slate-300 dark:border-white/10 bg-slate-100/50 dark:bg-white/[0.02] opacity-45'
          : 'border-slate-300 dark:border-white/15 bg-white dark:bg-[#0E131E] opacity-80';

  return (
    <div className={`px-3.5 py-2.5 rounded-2xl border min-w-[180px] max-w-[230px] transition-shadow ${statusStyles}`}>
      <Handle type="target" position={Position.Top} className="!bg-cyan-500 !w-2 !h-2" />
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {d.kind}
          </div>
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
            {d.label}
          </div>
          {d.sublabel && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{d.sublabel}</div>
          )}
        </div>
        {typeof d.progressPercent === 'number' && (
          <ProgressRing
            percent={d.progressPercent}
            size={34}
            strokeWidth={3}
            colorClass={d.status === 'completed' ? 'stroke-emerald-500' : 'stroke-cyan-500'}
          />
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !w-2 !h-2" />
    </div>
  );
};

const nodeTypes = { masarNode: MasarNode };

export const RoadmapScreen: React.FC = () => {
  const { state, markTopicStudied, updateState, pushToast } = useMasar();
  const t = getT(state.language);
  const isAr = state.language === 'ar';

  const [mode, setMode] = useState<RoadmapMode>('focus');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({
    'nti-1': true,
    'extra-1': true,
    'act-1': true,
  });
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [showAllItems, setShowAllItems] = useState(false);
  const [selectedNode, setSelectedNode] = useState<MasarNodeData | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  const { nodes, edges } = useMemo(() => {
    const builtNodes: Node[] = [];
    const builtEdges: Edge[] = [];

    builtNodes.push({
      id: 'root',
      type: 'masarNode',
      position: { x: 420, y: 0 },
      data: {
        label: 'Masar OS',
        sublabel: '4 Learning Queues',
        kind: 'root',
        status: 'current',
      } satisfies MasarNodeData,
    });

    const queues: QueueId[] = ['nti', 'extra', 'activity', 'language'];
    queues.forEach((q, qIdx) => {
      const qX = qIdx * 320;
      const qNodeId = `q-${q}`;
      const qCourses = state.courses.filter((c) => c.queue === q).sort((a, b) => a.order - b.order);

      const visibleCourses =
        mode === 'focus' || mode === 'today'
          ? qCourses.filter((c) => c.status === 'current' || c.status === 'completed')
          : qCourses;

      const completedCourses = qCourses.filter((c) => c.status === 'completed').length;
      const qPct = qCourses.length ? Math.round((completedCourses / qCourses.length) * 100) : 0;

      builtNodes.push({
        id: qNodeId,
        type: 'masarNode',
        position: { x: qX, y: 120 },
        data: {
          label: q.toUpperCase(),
          sublabel: `${qCourses.length} courses`,
          kind: 'queue',
          status: qCourses.some((c) => c.status === 'current') ? 'current' : 'upcoming',
          progressPercent: qPct,
          queueId: q,
        } satisfies MasarNodeData,
      });

      builtEdges.push({
        id: `e-root-${qNodeId}`,
        source: 'root',
        target: qNodeId,
        style: { stroke: '#06B6D4', strokeWidth: 2 },
      });

      let yCursor = 240;
      visibleCourses.forEach((course: Course, cIdx: number) => {
        const matchesSearch =
          !searchQuery.trim() ||
          course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          course.topics.some((tp) => tp.title.toLowerCase().includes(searchQuery.toLowerCase()));
        if (mode === 'search' && !matchesSearch) return;

        const prog = getCourseProgress(course);
        const cNodeId = `c-${course.id}`;
        const prevCourseId = cIdx > 0 ? `c-${visibleCourses[cIdx - 1].id}` : qNodeId;

        builtNodes.push({
          id: cNodeId,
          type: 'masarNode',
          position: { x: qX, y: yCursor },
          data: {
            label: course.title,
            sublabel: `${course.estimatedHours}h · ${course.topics.length} topics`,
            kind: 'course',
            status: course.status,
            progressPercent: prog.percent,
            courseId: course.id,
          } satisfies MasarNodeData,
        });

        builtEdges.push({
          id: `e-${prevCourseId}-${cNodeId}`,
          source: prevCourseId,
          target: cNodeId,
          animated: course.status === 'current',
          style: {
            stroke: course.status === 'completed' ? '#10B981' : course.status === 'current' ? '#06B6D4' : '#475569',
            strokeWidth: course.status === 'completed' ? 2.5 : 1.5,
          },
        });

        yCursor += 110;

        if (expandedCourses[course.id]) {
          course.topics.forEach((tp: Topic, tIdx: number) => {
            const tpNodeId = `tp-${tp.id}`;
            const tpStatus: MasarNodeData['status'] = tp.studied
              ? 'completed'
              : tIdx === 0 || course.topics[tIdx - 1]?.studied
                ? 'current'
                : 'locked';

            builtNodes.push({
              id: tpNodeId,
              type: 'masarNode',
              position: { x: qX + 40, y: yCursor },
              data: {
                label: tp.title,
                sublabel: `${tp.estimatedMinutes}m · ${tp.recalled ? 'Recalled' : tp.studied ? 'Studied' : 'Pending'}`,
                kind: 'topic',
                status: tpStatus,
                courseId: course.id,
                topicId: tp.id,
                prerequisites: tp.prerequisites,
              } satisfies MasarNodeData,
            });

            builtEdges.push({
              id: `e-${cNodeId}-${tpNodeId}`,
              source: cNodeId,
              target: tpNodeId,
              style: { stroke: tp.studied ? '#10B981' : '#64748B', strokeWidth: 1.5 },
            });
            yCursor += 95;

            if (showAllItems || expandedTopics[tp.id]) {
              tp.items.forEach((it) => {
                const itNodeId = `it-${it.id}`;
                builtNodes.push({
                  id: itNodeId,
                  type: 'masarNode',
                  position: { x: qX + 80, y: yCursor },
                  data: {
                    label: it.title,
                    sublabel: `${it.kind} · ${it.estimatedMinutes}m`,
                    kind: 'item',
                    status: it.completed ? 'completed' : 'upcoming',
                    courseId: course.id,
                    topicId: tp.id,
                    itemId: it.id,
                  } satisfies MasarNodeData,
                });
                builtEdges.push({
                  id: `e-${tpNodeId}-${itNodeId}`,
                  source: tpNodeId,
                  target: itNodeId,
                  style: { stroke: it.completed ? '#10B981' : '#334155', strokeWidth: 1 },
                });
                yCursor += 85;
              });
            }
          });
        }
      });
    });

    return { nodes: builtNodes, edges: builtEdges };
  }, [state.courses, mode, searchQuery, expandedCourses, expandedTopics, showAllItems]);

  React.useEffect(() => {
    if (!rfInstance) return;
    const timer = window.setTimeout(() => {
      rfInstance.fitView({ padding: 0.16, maxZoom: 1, duration: 250 });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [rfInstance, mode, nodes.length]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const d = node.data as MasarNodeData;
      const now = Date.now();
      if (now - lastTapRef.current < 280 && rfInstance) {
        rfInstance.fitView({ padding: 0.16, maxZoom: 1, duration: 300 });
      }
      lastTapRef.current = now;

      if (d.kind === 'course' && d.courseId) {
        setExpandedCourses((prev) => ({ ...prev, [d.courseId!]: !prev[d.courseId!] }));
      } else if (d.kind === 'topic' && d.topicId) {
        setExpandedTopics((prev) => ({ ...prev, [d.topicId!]: !prev[d.topicId!] }));
      }
      setSelectedNode(d);
      setEditTitle(d.label);
    },
    [rfInstance]
  );

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `masar-roadmap-${state.activeDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(isAr ? 'تم تصدير الخريطة بصيغة JSON.' : 'Roadmap exported as JSON.', 'success');
  };

  const handleExportPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#07090F';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Compute bounds
    const xs = nodes.map((n) => n.position.x);
    const ys = nodes.map((n) => n.position.y);
    const minX = Math.min(...xs, 0);
    const maxX = Math.max(...xs, 1000) + 240;
    const minY = Math.min(...ys, 0);
    const maxY = Math.max(...ys, 600) + 100;
    const scale = Math.min(1300 / Math.max(1, maxX - minX), 820 / Math.max(1, maxY - minY));

    const toPx = (x: number, y: number) => [40 + (x - minX) * scale, 40 + (y - minY) * scale];

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.5;
    for (const edge of edges) {
      const src = nodes.find((n) => n.id === edge.source);
      const dst = nodes.find((n) => n.id === edge.target);
      if (!src || !dst) continue;
      const [sx, sy] = toPx(src.position.x + 90, src.position.y + 30);
      const [dx, dy] = toPx(dst.position.x + 90, dst.position.y);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(dx, dy);
      ctx.stroke();
    }

    for (const node of nodes) {
      const d = node.data as MasarNodeData;
      const [px, py] = toPx(node.position.x, node.position.y);
      ctx.fillStyle = d.status === 'completed' ? '#064E3B' : d.status === 'current' ? '#164E63' : '#0E131E';
      ctx.strokeStyle = d.status === 'completed' ? '#10B981' : d.status === 'current' ? '#06B6D4' : '#334155';
      ctx.fillRect(px, py, 160 * scale, 44 * scale);
      ctx.strokeRect(px, py, 160 * scale, 44 * scale);
      ctx.fillStyle = '#F1F5F9';
      ctx.font = `${Math.max(10, Math.round(12 * scale))}px sans-serif`;
      ctx.fillText(d.label.slice(0, 24), px + 8, py + 24 * scale);
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `masar-roadmap-${state.activeDate}.png`;
      a.click();
      URL.revokeObjectURL(url);
      pushToast(isAr ? 'تم تصدير صورة الخريطة PNG.' : 'Roadmap exported as PNG.', 'success');
    });
  };

  const handleSaveNodeEdit = () => {
    if (!selectedNode || !editTitle.trim()) return;
    if (selectedNode.kind === 'course' && selectedNode.courseId) {
      updateState((p) => ({
        ...p,
        courses: p.courses.map((c) => (c.id === selectedNode.courseId ? { ...c, title: editTitle.trim() } : c)),
      }));
    } else if (selectedNode.kind === 'topic' && selectedNode.courseId && selectedNode.topicId) {
      updateState((p) => ({
        ...p,
        courses: p.courses.map((c) =>
          c.id === selectedNode.courseId
            ? {
                ...c,
                topics: c.topics.map((tp) => (tp.id === selectedNode.topicId ? { ...tp, title: editTitle.trim() } : tp)),
              }
            : c
        ),
      }));
    }
    setSelectedNode(null);
    pushToast(isAr ? 'تم تحديث العقدة.' : 'Node updated.', 'success');
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
          {(['today', 'all', 'focus', 'search'] as RoadmapMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                mode === m
                  ? 'bg-white dark:bg-cyan-600 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.roadmap[`${m}Mode` as 'todayMode' | 'allMode' | 'focusMode' | 'searchMode']}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'search' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'تصفية العقد...' : 'Filter nodes...'}
                className="min-h-[38px] ps-8 pe-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowAllItems((v) => !v)}
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-xl border text-xs font-medium ${
              showAllItems
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                : 'border-slate-200 dark:border-white/10'
            }`}
          >
            {showAllItems ? t.roadmap.collapseTopics : t.roadmap.expandAll}
          </button>
          <button
            type="button"
            onClick={() => rfInstance?.fitView({ padding: 0.16, maxZoom: 1, duration: 300 })}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            {t.roadmap.fitView}
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            PNG
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium"
          >
            JSON
          </button>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div
        data-testid="roadmap-canvas"
        className="h-[62dvh] min-h-[420px] rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#07090F]"
        onTouchStart={() => {
          longPressTimer.current = window.setTimeout(() => {
            rfInstance?.fitView({ padding: 0.16, maxZoom: 1, duration: 300 });
          }, 600);
        }}
        onTouchEnd={() => {
          if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onInit={setRfInstance}
          fitView
          fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
          minZoom={0.25}
          maxZoom={2}
        >
          <Background gap={22} size={1} color="rgba(148,163,184,0.15)" />
          <Controls className="!bg-white dark:!bg-[#0E131E] !border-slate-200 dark:!border-white/10" />
          <MiniMap pannable zoomable className="!bg-white/90 dark:!bg-[#0E131E]/90 !border-slate-200 dark:!border-white/10" />
        </ReactFlow>
      </div>

      {/* Bottom Sheet Inspector */}
      <BottomSheet
        open={!!selectedNode}
        onClose={() => setSelectedNode(null)}
        title={selectedNode?.label || 'Node'}
      >
        {selectedNode && (
          <div className="space-y-4 text-sm">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {selectedNode.kind.toUpperCase()} · {selectedNode.status}
              {selectedNode.sublabel ? ` · ${selectedNode.sublabel}` : ''}
            </div>

            {(selectedNode.kind === 'course' || selectedNode.kind === 'topic') && (
              <label className="block">
                <span className="text-xs text-slate-500">{isAr ? 'تعديل العنوان' : 'Edit title'}</span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                />
              </label>
            )}

            {selectedNode.kind === 'topic' && selectedNode.courseId && selectedNode.topicId && (
              <button
                type="button"
                onClick={() => {
                  markTopicStudied(selectedNode.courseId!, selectedNode.topicId!, selectedNode.status !== 'completed');
                  setSelectedNode(null);
                }}
                className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                {selectedNode.status === 'completed'
                  ? isAr ? 'إلغاء الإتمام' : 'Mark Pending'
                  : isAr ? 'تحديد كمكتمل' : 'Mark Topic Studied'}
              </button>
            )}

            {(selectedNode.kind === 'course' || selectedNode.kind === 'topic') && (
              <button
                type="button"
                onClick={handleSaveNodeEdit}
                className="w-full min-h-[44px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
              >
                {t.common.save}
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
