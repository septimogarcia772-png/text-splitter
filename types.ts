
export enum BlockType {
  NORMAL = 'NORMAL',
  SPECIAL_TRIGGER = 'SPECIAL_TRIGGER',
  POST_SPECIAL = 'POST_SPECIAL'
}

export interface TextBlock {
  id: string;
  content: string;
  type: BlockType;
}

export interface AppState {
  fullText: string;
  blocks: TextBlock[];
  activeBlockIndex: number | null;
}
