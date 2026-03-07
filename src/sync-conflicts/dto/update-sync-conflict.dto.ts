import { PartialType } from '@nestjs/swagger';
import { CreateSyncConflictDto } from './create-sync-conflict.dto';

export class UpdateSyncConflictDto extends PartialType(CreateSyncConflictDto) {}
