import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @GrpcMethod('AuthService', 'Register') register(d: any) { return this.auth.register(d); }
  @GrpcMethod('AuthService', 'Login') login(d: any) { return this.auth.login(d); }
  @GrpcMethod('AuthService', 'ValidateToken') validate(d: any) { return this.auth.validateToken(d); }
  @GrpcMethod('AuthService', 'GetUser') getUser(d: any) { return this.auth.getUser(d); }
}
