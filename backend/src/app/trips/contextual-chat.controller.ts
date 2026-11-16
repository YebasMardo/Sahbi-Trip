import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SuccessResponse, SuccessResponseEnum } from 'src/core/httpResponse/SuccessResponse';
import { ContextualChatService } from './contextual-chat.service';
import { ChatContextualDto } from './dto/chat-contextual.dto';

// Floating chat widget's single endpoint — separate from the per-trip
// /trips/:id/chat (which runs the full tool-calling agent). This one is
// plain grounded Q&A across four page contexts, see ContextualChatService.
@ApiTags('Chat')
@ApiBearerAuth()
@Controller('/api/v1/chat')
export class ContextualChatController {
  constructor(private readonly contextualChatService: ContextualChatService) {}

  @HttpCode(HttpStatus.OK)
  @Post('/contextual')
  async contextual(@Req() request: Request, @Body() dto: ChatContextualDto) {
    const result = await this.contextualChatService.chat(request.user.sub, dto);
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, result);
  }
}
