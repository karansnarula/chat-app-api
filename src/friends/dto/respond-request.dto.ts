import { IsEnum } from 'class-validator';

enum RequestAction {
  ACCEPT = 'accept',
  DECLINE = 'decline',
}

export class RespondRequestDto {
  @IsEnum(RequestAction)
  action: RequestAction;
}