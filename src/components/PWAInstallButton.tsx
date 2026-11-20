import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../pwa/usePWAInstall';
import { BottomSheet } from './BottomSheet';

export const PWAInstallButton: React.FC<{ language?: 'en' | 'ar' }> = ({ language = 'en' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4" />
        {language === 'ar' ? 'تثبيت التطبيق' : 'Install App'}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-white/15 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-4 h-4" />
          {language === 'ar' ? 'تثبيت على iOS' : 'Install on iPhone'}
        </button>

        <BottomSheet
          open={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          title={language === 'ar' ? 'تثبيت مَسَار OS على iPhone' : 'Install Masar OS on iPhone'}
        >
          <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-300 list-decimal list-inside">
            <li>
              {language === 'ar'
                ? 'اضغط على زر المشاركة (Share) في شريط Safari.'
                : 'Tap the Share button in the Safari browser toolbar.'}
            </li>
            <li>
              {language === 'ar'
                ? 'مرر للأسفل واختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                : 'Scroll down and tap "Add to Home Screen".'}
            </li>
            <li>
              {language === 'ar'
                ? 'اضغط إضافة لتشغيل مَسَار OS كتطبيق مستقل.'
                : 'Tap Add to launch Masar OS in standalone mode.'}
            </li>
          </ol>
        </BottomSheet>
      </>
    );
  }

  return null;
};
