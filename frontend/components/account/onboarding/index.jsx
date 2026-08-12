import { useEffect, useMemo, useState } from 'react';
import Button from '../../ui/Button';
import Card from '../../ui/Card';
import ProgressBar from '../../ui/ProgressBar';
import Tooltip from '../../ui/Tooltip';
import SectionCard from '../_shared/SectionCard';

export function WelcomeScreen({ title = 'Welcome to Fintranzact', subtitle = 'Let’s get you set up.', onStart }) {
  return (
    <div className="rounded-2xl bg-fintranzact-gradient text-white p-8 shadow">
      <div className="text-3xl font-semibold">{title}</div>
      <div className="mt-2 text-white/90">{subtitle}</div>
      <div className="mt-6">
        <Button onClick={onStart} className="bg-white text-primary-700 hover:bg-primary-50">Get started</Button>
      </div>
    </div>
  );
}

export function FeatureTourWalkthrough({ steps = [], current = 0, onNext, onBack }) {
  const step = steps[current] || {};
  return (
    <SectionCard title="Feature tour" subtitle={`${current + 1} of ${steps.length || 1}`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBack} disabled={current === 0}>Back</Button>
          <Button size="sm" onClick={onNext} disabled={current >= steps.length - 1}>Next</Button>
        </div>
      }
    >
      <div className="text-sm text-gray-700">
        <div className="font-semibold text-gray-900">{step.title}</div>
        <div className="mt-1">{step.description}</div>
      </div>
    </SectionCard>
  );
}

export function StepProgressIndicator({ current = 1, total = 3 }) {
  const pct = total ? (current / total) * 100 : 0;
  return <ProgressBar value={pct} label={`Step ${current} of ${total}`} />;
}

export function OnboardingChecklist({ items = [], onToggle }) {
  return (
    <SectionCard title="Checklist" subtitle="Finish these to complete setup.">
      <div className="space-y-2">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className={
              "w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors " +
              (it.done ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:bg-gray-50')
            }
            onClick={() => onToggle?.(it)}
          >
            <div>
              <div className="text-sm font-semibold text-gray-900">{it.title}</div>
              {it.description ? <div className="text-xs text-gray-500">{it.description}</div> : null}
            </div>
            <div className={it.done ? 'text-green-700' : 'text-gray-400'}>{it.done ? 'Done' : 'Todo'}</div>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

export function TutorialTooltips({ content, children }) {
  return (
    <Tooltip content={content}>
      {children}
    </Tooltip>
  );
}

export function QuickStartGuideCard({ title = 'Quick start', steps = [] }) {
  return (
    <Card className="shadow-sm">
      <div className="text-lg font-semibold text-gray-900">{title}</div>
      <ol className="mt-3 list-decimal pl-5 text-sm text-gray-700 space-y-1">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </Card>
  );
}

export function SkipNextButtons({ onSkip, onNext, nextLabel = 'Next' }) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" onClick={onSkip}>Skip</Button>
      <Button onClick={onNext}>{nextLabel}</Button>
    </div>
  );
}
