export interface RoomData {
  hostId: string;
  type: 'text' | 'image';
  content: string;
  imageData: string | null;
  align?: 'left' | 'center' | 'right' | 'justify' | string;
  createdAt?: any;
  lastActive?: any;
}
