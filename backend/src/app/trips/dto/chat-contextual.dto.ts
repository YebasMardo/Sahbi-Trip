import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';

export const CHAT_CONTEXTS = ['dashboard', 'trip', 'day', 'activity'] as const;
export type ChatContext = (typeof CHAT_CONTEXTS)[number];

class ChatHistoryTurnDto {
  @ApiProperty({ type: String, enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(2000)
  content: string;
}

// Powers the floating contextual chat widget (dashboard / trip / day /
// activity). `contextId` encodes whatever the backend needs to look up the
// right slice of real data — see ContextualChatService for the exact scheme
// per context (never invented here, always resolved server-side).
export class ChatContextualDto {
  @ApiProperty({ type: String, enum: CHAT_CONTEXTS })
  @IsIn(CHAT_CONTEXTS)
  context: ChatContext;

  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  contextId?: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @ApiProperty({ type: [ChatHistoryTurnDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryTurnDto)
  history?: ChatHistoryTurnDto[];
}
