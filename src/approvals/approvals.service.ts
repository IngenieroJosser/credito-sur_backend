import { Injectable } from '@nestjs/common';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createApprovalDto: CreateApprovalDto) {
    return 'This action adds a new approval';
  }

  findAll() {
    return `This action returns all approvals`;
  }

  findOne(id: number) {
    return `This action returns a #${id} approval`;
  }

  update(id: number, updateApprovalDto: UpdateApprovalDto) {
    return `This action updates a #${id} approval`;
  }

  remove(id: number) {
    return `This action removes a #${id} approval`;
  }
}
