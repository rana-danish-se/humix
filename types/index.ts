export type Platform = "LinkedIn" | "Reddit" ;

export interface PostFormData {
  postText: string;
  platform: Platform;
  context: string;
}
