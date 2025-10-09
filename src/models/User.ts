import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    clerkId: string;
    username: string; // REQUIRED - Added per frontend requirements
    email?: string; // OPTIONAL - May be missing for phone-only users
    phoneNumber?: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatar?: string;
    role?: 'singer' | 'admin';
    pushToken?: string;
    orgId?: string; // Clerk organization ID for admins
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>(
    {
        clerkId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        username: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        email: {
            type: String,
            required: false, // Optional - may be missing for phone-only users
            sparse: true, // Allow multiple null values
        },
        phoneNumber: String,
        firstName: String,
        lastName: String,
        displayName: String,
        avatar: String,
        role: {
            type: String,
            enum: ['singer', 'admin'],
            default: 'singer',
        },
        pushToken: String,
        orgId: String,
    },
    {
        timestamps: true,
    }
);

// Index for searching users (including username)
userSchema.index({ username: 'text', displayName: 'text', firstName: 'text', lastName: 'text', email: 'text' });

export const User = mongoose.model<IUser>('User', userSchema);
