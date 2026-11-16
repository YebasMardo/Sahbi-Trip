import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PublicAccess } from 'src/app/auth/decorators/public-access.decorator';
import { SuccessResponse, SuccessResponseEnum } from 'src/core/httpResponse/SuccessResponse';
import { LlmHealthService } from './llm-health.service';

@ApiTags('AI')
@PublicAccess()
@Controller('/api/v1/ai')
export class AiController {
  constructor(private readonly llmHealthService: LlmHealthService) {}

  @Get('/health')
  async health() {
    const report = await this.llmHealthService.check();
    return new SuccessResponse(SuccessResponseEnum.OK, undefined, report);
  }
}
