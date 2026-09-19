import type { WhiteboardShapeType } from '../../lib/types';

/**
 * Data-driven shape library registry — 100 visually DISTINCT geometries.
 *
 * Rule (user-locked): every item renders a unique SVG path. Preset labels
 * were removed — items place blank shapes; the user labels them. A global
 * uniqueness test (geometry.test.ts) fails the build if any two items ever
 * render the same path string.
 */
export type ShapeLibraryTabId =
  | 'basic'
  | 'flowchart'
  | 'bpmn'
  | 'uml'
  | 'erd'
  | 'dataflow'
  | 'network'
  | 'k8s';

export interface LibraryItem {
  /** Stable id `${tab}:${slug}` — persisted in wb:shapeRecent. */
  id: string;
  tab: ShapeLibraryTabId;
  shapeType: WhiteboardShapeType;
  /** Display name in the panel (technical terms stay English by design). */
  name: string;
}

export interface ShapeLibraryTab {
  id: ShapeLibraryTabId;
  /** i18n key suffix: whiteboard.shapeLib.tab<Basic|Flowchart|...> */
  labelKey: string;
  items: LibraryItem[];
}

const item = (
  tab: ShapeLibraryTabId,
  slug: string,
  shapeType: WhiteboardShapeType,
  name: string,
): LibraryItem => ({ id: `${tab}:${slug}`, tab, shapeType, name });

const BASIC: LibraryItem[] = [
  item('basic', 'rectangle', 'rect', 'Rectangle'),
  item('basic', 'rounded-rect', 'roundedRect', 'Rounded rect'),
  item('basic', 'ellipse', 'ellipse', 'Ellipse'),
  item('basic', 'diamond', 'diamond', 'Diamond'),
  item('basic', 'triangle', 'triangleUp', 'Triangle'),
  item('basic', 'inverted-triangle', 'triangleDown', 'Inverted triangle'),
  item('basic', 'right-triangle', 'triangleRight', 'Right triangle'),
  item('basic', 'capsule', 'capsule', 'Capsule'),
  item('basic', 'cylinder', 'cylinder', 'Cylinder'),
  item('basic', 'horizontal-cylinder', 'hCylinder', 'Horizontal cylinder'),
  item('basic', 'parallelogram', 'parallelogram', 'Parallelogram'),
  item('basic', 'trapezoid', 'trapezoid', 'Trapezoid'),
  item('basic', 'right-trapezoid', 'trapezoidRight', 'Right trapezoid'),
  item('basic', 'hexagon', 'hexagon', 'Hexagon'),
  item('basic', 'pentagon', 'pentagon', 'Pentagon'),
  item('basic', 'octagon', 'octagon', 'Octagon'),
  item('basic', 'document', 'document', 'Document'),
  item('basic', 'snipped-rect', 'snipRect', 'Snipped rect'),
  item('basic', 'chamfered-rect', 'chamferRect', 'Chamfered rect'),
  item('basic', 'rounded-diamond', 'roundedDiamond', 'Rounded diamond'),
  item('basic', 'plus', 'plusBlock', 'Plus'),
  item('basic', 'chevron', 'chevronRight', 'Chevron'),
  item('basic', 'double-chevron', 'doubleChevron', 'Double chevron'),
  item('basic', 'directional-pentagon', 'pentagonRight', 'Directional pentagon'),
  item('basic', 'star-5', 'star5', 'Star 5'),
  item('basic', 'sparkle-4', 'star4', 'Sparkle 4'),
  item('basic', 'burst-seal', 'sealBurst', 'Burst seal'),
  item('basic', 'shield', 'shieldBox', 'Shield'),
  item('basic', 'semicircle', 'semicircle', 'Semicircle'),
  item('basic', 'pie-slice', 'pieSlice', 'Pie slice'),
  item('basic', 'hex-nut', 'nutHex', 'Hex nut'),
  item('basic', 'cube', 'cubeBox', 'Cube'),
  item('basic', 'envelope', 'envelopeBox', 'Envelope'),
  item('basic', 'calendar', 'calendarBox', 'Calendar'),
  item('basic', 'clock', 'clockFace', 'Clock'),
];

const FLOWCHART: LibraryItem[] = [
  item('flowchart', 'predefined-process', 'predefinedProcess', 'Predefined process'),
  item('flowchart', 'manual-input', 'manualInput', 'Manual input'),
  item('flowchart', 'off-page-reference', 'offPageRef', 'Off-page reference'),
  item('flowchart', 'delay', 'delayHalf', 'Delay'),
  item('flowchart', 'multi-document', 'multiDocument', 'Multi-document'),
  item('flowchart', 'or-junction', 'orJunction', 'Or junction'),
  item('flowchart', 'sum-junction', 'sumJunction', 'Sum junction'),
  item('flowchart', 'cross-document', 'crossDoc', 'Cross document'),
];

const BPMN: LibraryItem[] = [
  item('bpmn', 'intermediate-event', 'intermediateRing', 'Intermediate event'),
  item('bpmn', 'message-event', 'messageEvent', 'Message event'),
  item('bpmn', 'timer-event', 'timerEvent', 'Timer event'),
  item('bpmn', 'error-event', 'errorEvent', 'Error event'),
  item('bpmn', 'exclusive-gateway', 'exclusiveGateway', 'Exclusive gateway'),
  item('bpmn', 'parallel-gateway', 'parallelGateway', 'Parallel gateway'),
  item('bpmn', 'inclusive-gateway', 'inclusiveGateway', 'Inclusive gateway'),
  item('bpmn', 'complex-gateway', 'complexGateway', 'Complex gateway'),
  item('bpmn', 'sub-process', 'subProcess', 'Sub-process'),
  item('bpmn', 'task-marker', 'taskMarker', 'Task marker'),
];

const UML: LibraryItem[] = [
  item('uml', 'class', 'classBox', 'Class'),
  item('uml', 'package', 'packageBox', 'Package'),
  item('uml', 'component', 'componentBox', 'Component'),
  item('uml', 'actor', 'actorFigure', 'Actor'),
  item('uml', 'node', 'nodeBox', 'Node'),
  item('uml', 'interface-ball', 'interfaceBall', 'Interface ball'),
  item('uml', 'object', 'objectBox', 'Object'),
  item('uml', 'signal-receipt', 'signalReceipt', 'Signal receipt'),
  item('uml', 'partition-activity', 'partitionActivity', 'Partition activity'),
  item('uml', 'generalization', 'generalizationTri', 'Generalization'),
];

const ERD: LibraryItem[] = [
  item('erd', 'weak-entity', 'weakEntity', 'Weak entity'),
  item('erd', 'identifying-relationship', 'identifyingRel', 'Identifying relationship'),
  item('erd', 'multi-attribute', 'multiAttribute', 'Multi attribute'),
  item('erd', 'key-attribute', 'keyAttribute', 'Key attribute'),
  item('erd', 'associative-entity', 'associativeBox', 'Associative entity'),
  item('erd', 'category-cluster', 'categoryCluster', 'Category cluster'),
  item('erd', 'ternary-relationship', 'ternaryInner', 'Ternary relationship'),
];

const DATAFLOW: LibraryItem[] = [
  item('dataflow', 'open-data-store', 'datastoreOpen', 'Open data store'),
  item('dataflow', 'yourdon-data-store', 'yourdonStore', 'Yourdon data store'),
  item('dataflow', 'disk-stack', 'diskStack', 'Disk stack'),
  item('dataflow', 'ruled-file', 'fileRuled', 'Ruled file'),
  item('dataflow', 'punch-card', 'punchCard', 'Punch card'),
];

const NETWORK: LibraryItem[] = [
  item('network', 'server', 'serverBox', 'Server'),
  item('network', 'router', 'routerBox', 'Router'),
  item('network', 'cloud', 'cloudShape', 'Cloud'),
  item('network', 'firewall', 'firewallBox', 'Firewall'),
  item('network', 'antenna-tower', 'antennaTower', 'Antenna tower'),
  item('network', 'printer', 'printerBox', 'Printer'),
  item('network', 'switch', 'switchStack', 'Switch'),
  item('network', 'hub', 'hubSpoke', 'Hub'),
  item('network', 'modem', 'modemBox', 'Modem'),
  item('network', 'satellite-dish', 'satelliteDish', 'Satellite dish'),
  item('network', 'laptop', 'laptopSlab', 'Laptop'),
  item('network', 'rack-cabinet', 'rackCabinet', 'Rack cabinet'),
  item('network', 'load-balancer', 'loadBalancer', 'Load balancer'),
];

const K8S: LibraryItem[] = [
  item('k8s', 'pod', 'podHex', 'Pod'),
  item('k8s', 'service', 'serviceMesh', 'Service'),
  item('k8s', 'deployment', 'deployBox', 'Deployment'),
  item('k8s', 'ingress', 'ingressArrow', 'Ingress'),
  item('k8s', 'configmap', 'configBox', 'ConfigMap'),
  item('k8s', 'namespace', 'namespaceBox', 'Namespace'),
  item('k8s', 'cronjob', 'cronBox', 'CronJob'),
  item('k8s', 'secret', 'secretVault', 'Secret'),
  item('k8s', 'banded-cylinder', 'bandedCylinder', 'Banded cylinder'),
  item('k8s', 'sidecar', 'sidecarBox', 'Sidecar'),
  item('k8s', 'readiness-probe', 'readinessProbe', 'Readiness probe'),
  item('k8s', 'replicaset', 'replicaBars', 'ReplicaSet'),
];

export const SHAPE_LIBRARY_TABS: ShapeLibraryTab[] = [
  { id: 'basic', labelKey: 'whiteboard.shapeLib.tabBasic', items: BASIC },
  { id: 'flowchart', labelKey: 'whiteboard.shapeLib.tabFlowchart', items: FLOWCHART },
  { id: 'bpmn', labelKey: 'whiteboard.shapeLib.tabBpmn', items: BPMN },
  { id: 'uml', labelKey: 'whiteboard.shapeLib.tabUml', items: UML },
  { id: 'erd', labelKey: 'whiteboard.shapeLib.tabErd', items: ERD },
  { id: 'dataflow', labelKey: 'whiteboard.shapeLib.tabDataflow', items: DATAFLOW },
  { id: 'network', labelKey: 'whiteboard.shapeLib.tabNetwork', items: NETWORK },
  { id: 'k8s', labelKey: 'whiteboard.shapeLib.tabK8s', items: K8S },
];

export const LIBRARY_ITEM_BY_ID: ReadonlyMap<string, LibraryItem> = new Map(
  SHAPE_LIBRARY_TABS.flatMap((t) => t.items.map((i) => [i.id, i] as const)),
);

export const SHAPE_LIBRARY_COUNT: number = SHAPE_LIBRARY_TABS.reduce((n, t) => n + t.items.length, 0);

const RECENT_KEY = 'wb:shapeRecent';
const RECENT_MAX = 8;

export function readShapeRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && LIBRARY_ITEM_BY_ID.has(v)).slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

export function pushShapeRecent(id: string): string[] {
  const next = [id, ...readShapeRecent().filter((v) => v !== id)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode — recent simply doesn't persist */
  }
  return next;
}
