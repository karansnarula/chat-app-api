import { IsEmail } from 'class-validator';

export class SendRequestDto {
  @IsEmail()
  email: string;
}