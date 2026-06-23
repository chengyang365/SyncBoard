export interface RoomData {
  hostId: string;
  type: 'text' | 'image' | 'namePicker' | 'timer';
  content: string;
  imageData: string | null;
  align?: 'left' | 'center' | 'right' | 'justify' | string;
  createdAt?: any;
  lastActive?: any;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  speakTrigger?: number;
  textColor?: string;
  fontFamily?: 'sans' | 'serif' | 'mono';
  fontSize?: number;
  
  // Name Picker State
  namesList?: string;
  pickedResult?: string | null;
  isPickerRolling?: boolean;
  pickerRollTrigger?: number;

  // Timer State
  timerDuration?: number;
  timerTimeLeft?: number;
  timerRunning?: boolean;
  timerUpdated?: number;

  // Laser Pointer State
  laserX?: number;
  laserY?: number;
  laserActive?: boolean;

  // Sync Room Theme State
  theme?: 'light' | 'dark';

  // Shared History List
  historyList?: Array<{
    id: string;
    type: 'text' | 'image';
    content: string;
    imageData: string | null;
    savedAt: number;
  }>;
}
