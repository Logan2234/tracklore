import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

/** Full replacement order — every item id of the list, new order first. */
export class ReorderListItemsBody {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderedItemIds!: string[];
}
