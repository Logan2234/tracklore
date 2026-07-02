import { MediaType } from '@tracklore/shared';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class SearchQueryDto {
  @IsString()
  @MinLength(1)
  q!: string;

  @IsOptional()
  @IsIn(Object.values(MediaType))
  type?: MediaType;
}
