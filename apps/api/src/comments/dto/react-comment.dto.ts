import {
  CommentEmote,
  type CommentEmote as CommentEmoteT,
} from "@tracklore/shared";
import { IsIn } from "class-validator";

export class ReactCommentBody {
  @IsIn(Object.values(CommentEmote))
  emote!: CommentEmoteT;
}
