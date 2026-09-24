import { BugBeetle, CellSignalFull, CellSignalLow, CellSignalMedium, CircleDashed, DoorOpen, ExclamationMark, FirstAid, HourglassMedium, MinusCircle, Scan, SealCheck, Siren, StopCircle, WarningDiamond, Wrench } from '@phosphor-icons/react';
import type { IssueSeverity, IssueStatus, TaskPriority, TaskStatus } from './types';

interface TaskStatusIconProps {
  status: TaskStatus;
  size?: number;
}

/**
 * Ikon per status task — satu sumber untuk modal, kartu, kalender, tooltip.
 * Dipilih dari ikon yang belum dipakai di proyek (audit 2026-09-23):
 * lingkaran putus = belum mulai, jam pasir = berjalan,
 * berkas diperiksa = review, segel = selesai.
 */
export function TaskStatusIcon({ status, size = 12 }: TaskStatusIconProps) {
  const common = { size, 'aria-hidden': true } as const;
  switch (status) {
    case 'todo':
      return <CircleDashed weight="bold" {...common} />;
    case 'inProgress':
      return <HourglassMedium weight="bold" {...common} />;
    case 'review':
      return <Scan weight="bold" {...common} />;
    case 'done':
      return <SealCheck weight="fill" {...common} />;
  }
}

interface TaskPriorityIconProps {
  priority: TaskPriority;
  size?: number;
}

/**
 * Ikon per prioritas task — tangga bar-sinyal ala Linear: 1/2/3 bar + "!".
 * Dipilih dari ikon yang belum dipakai di proyek (audit + verifikasi
 * dist v2.1.10 — CellSignal dan ExclamationMark ada, SignalLow/High tidak ada).
 */
export function TaskPriorityIcon({ priority, size = 12 }: TaskPriorityIconProps) {
  const common = { size, 'aria-hidden': true } as const;
  switch (priority) {
    case 'low':
      return <CellSignalLow weight="bold" {...common} />;
    case 'medium':
      return <CellSignalMedium weight="bold" {...common} />;
    case 'high':
      return <CellSignalFull weight="bold" {...common} />;
    case 'urgent':
      return <ExclamationMark weight="fill" {...common} />;
  }
}

interface TaskSeverityIconProps {
  severity: IssueSeverity;
  size?: number;
}

/**
 * Ikon per severity issue — keluarga peringatan: sirene / wajik /
 * seru / lingkaran-minus. Sengaja beda bentuk dari tangga tren
 * prioritas agar kedua dimensi tak tertukar saat berdampingan.
 * Dipilih dari ikon yang belum dipakai di proyek (audit + verifikasi dist).
 */
export function TaskSeverityIcon({ severity, size = 12 }: TaskSeverityIconProps) {
  const common = { size, 'aria-hidden': true } as const;
  switch (severity) {
    case 'critical':
      return <Siren weight="fill" {...common} />;
    case 'high':
      return <WarningDiamond weight="bold" {...common} />;
    case 'medium':
      return <ExclamationMark weight="bold" {...common} />;
    case 'low':
      return <MinusCircle weight="bold" {...common} />;
  }
}

interface IssueStatusIconProps {
  status: IssueStatus;
  size?: number;
}

/**
 * Ikon per status issue — dibuka / kumbang terkonfirmasi / kunci inggris /
 * P3K / berhenti. Keluarga sendiri, disjoint dari status task, severity,
 * dan prioritas agar tak tertukar saat berdampingan.
 * Dipilih dari ikon yang belum dipakai di proyek (audit + verifikasi dist).
 */
export function IssueStatusIcon({ status, size = 12 }: IssueStatusIconProps) {
  const common = { size, 'aria-hidden': true } as const;
  switch (status) {
    case 'open':
      return <DoorOpen weight="bold" {...common} />;
    case 'reproduced':
      return <BugBeetle weight="bold" {...common} />;
    case 'fixing':
      return <Wrench weight="bold" {...common} />;
    case 'resolved':
      return <FirstAid weight="bold" {...common} />;
    case 'wontfix':
      return <StopCircle weight="bold" {...common} />;
  }
}
