import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(new Types.ObjectId(id)).exec();
  }

  create(
    data: Pick<User, 'fullname' | 'email' | 'password'>,
  ): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  update(
    id: string,
    data: Partial<
      Pick<
        User,
        'password' | 'emailVerified' | 'fullname' | 'email' | 'avatarUrl'
      >
    >,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(new Types.ObjectId(id), data, {
        returnDocument: 'after',
      })
      .exec();
  }
}
