import {
  BookOpen,
  Camera,
  FileText,
  Megaphone,
  Mic,
  Monitor,
  PenTool,
  Shapes,
  Video,
  type LucideIcon,
} from 'lucide-react-native';

const ICONS: Record<string, LucideIcon> = {
  video: Video,
  monitor: Monitor,
  'pen-tool': PenTool,
  megaphone: Megaphone,
  camera: Camera,
  'book-open': BookOpen,
  'file-text': FileText,
  mic: Mic,
};

export const categoryIcon = (name: string): LucideIcon => ICONS[name] ?? Shapes;
