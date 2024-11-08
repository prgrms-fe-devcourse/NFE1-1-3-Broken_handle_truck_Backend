import bcrypt from 'bcrypt';
import { Comment, Store, User } from '@/models';
import { AppError } from '@/utils';
import {
	generateAccessToken,
	generateRefreshToken,
	IPayload,
} from '@/utils/jwt';
import mongoose from 'mongoose';
import { IUserData } from '@/utils/kakao';
import Bookmark from '@/models/Bookmark';
import Notification from '@/models/Notification';

// 회원가입 로직
export const localRegisterUser = async (
	email: string,
	password: string,
	nickname: string,
) => {
	// 1. 중복가입 조회
	const isUser = await User.findOne({ email });
	if (isUser) throw new AppError('이미 가입된 이메일 입니다.', 409);

	// 2. 사용자 생성
	const newUser = new User({
		email,
		password,
		nickname,
	});
	const user = await newUser.save();

	const payload: IPayload = {
		_id: user.id,
		nickname: user.nickname,
		role: user.role,
	};

	// 3. 토큰 생성
	const accessToken = generateAccessToken(payload);
	const refreshToken = generateRefreshToken(payload);

	return {
		accessToken,
		refreshToken,
		user: {
			_id: user.id,
			nickname: user.nickname,
			role: user.role,
			thumnail: user.thumnail ? user.thumnail : '',
		},
	};
};

// 이메일 중복확인 로직
export const checkEmail = async (email: string) => {
	const user = await User.findOne({ email });

	return !user;
};

// 로그인 로직
export const localLoginUser = async (email: string, password: string) => {
	// 1. 사용자 조회
	const user = await User.findOne({ email }).select('+password');
	if (!user) throw new AppError('잘못된 이메일 또는 패스워드 입니다.', 401);

	// 2. 비밀번호 검증
	const isMatch = await bcrypt.compare(password, user.password);
	if (!isMatch) throw new AppError('잘못된 이메일 또는 패스워드 입니다.', 401);

	const payload: IPayload = {
		_id: user.id,
		nickname: user.nickname,
		role: user.role,
	};

	// 3. 토큰 생성
	const accessToken = generateAccessToken(payload);
	const refreshToken = generateRefreshToken(payload);

	return {
		accessToken,
		refreshToken,
		user: {
			_id: user.id,
			nickname: user.nickname,
			role: user.role,
			thumnail: user.thumnail ? user.thumnail : '',
		},
	};
};

// 회원탈퇴 로직
export const deleteUser = async (userId: string) => {
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		// 1. 사용자 조회
		const user = await User.findById(userId).session(session);
		if (!user) throw new AppError('사용자 정보를 찾을 수 없습니다.', 404);

		// 2. 사용자의 Store 확인 및 관련 Comment 삭제
		const store = await Store.findOne({ ownerId: userId }).session(session);
		if (store) {
			await Comment.deleteMany({ storeId: store.id }).session(session);
			// 확장성 고려 deleteMany 사용
			await Notification.deleteMany({ sender: store.id }).session(session);
			await Store.findByIdAndDelete(store.id).session(session);
		}

		// 3. 관련 Bookmark 삭제
		await Bookmark.deleteMany({ userId }).session(session);

		// 4. 관련 Notification에서 사용자 ID 삭제
		await Notification.updateMany(
			{ recipients: userId },
			{ $pull: { recipients: userId } },
		).session(session);

		// 5. 관련 Comments 삭제
		await Comment.deleteMany({ authorId: userId }).session(session);

		// 6. 사용자 삭제
		await User.findByIdAndDelete(user.id).session(session);

		await session.commitTransaction();
	} catch (e) {
		await session.abortTransaction();
		session.endSession();

		if (e instanceof AppError) throw e;
		else
			throw new AppError(
				'회원 탈퇴 중 오류가 발생했습니다. 모든 작업이 원복됩니다.',
				500,
			);
	} finally {
		session.endSession();
	}
};

// 카카오 로그인 로직
export const kakaoLogin = async (userData: IUserData) => {
	let user = await User.findOne({ oAuthIdKey: userData.id, oAuth: 'Kakao' });

	if (!user) {
		const newUser = new User({
			oAuth: 'Kakao',
			oAuthIdKey: userData.id,
			nickname: userData.kakao_account.profile.nickname,
			thumnail: userData.kakao_account.profile.thumbnail_image_url,
		});

		user = await newUser.save();
		if (!user) throw new AppError('카카오 사용자 등록에 실패했습니다.', 500);
	}

	const payload: IPayload = {
		_id: user.id,
		nickname: user.nickname,
		role: user.role,
	};

	const accessToken = generateAccessToken(payload);
	const refreshToken = generateRefreshToken(payload);

	return { accessToken, refreshToken };
};

// 닉네임 변경 로직
export const editNickname = async (userId: string, newNickname: string) => {
	const user = User.findByIdAndUpdate(
		userId,
		{
			nickname: newNickname,
		},
		{ new: true, runValidators: true },
	).select('-password -email');

	if (!user) throw new AppError('사용자를 찾을 수 없습니다.', 404);

	return user;
};

// 사용자 로그인 확인
export const authValidation = async (userId: string) => {
	const user = await User.findById(userId).select('nickname role thumnail');

	if (!user) throw new AppError('사용자를 찾을 수 없습니다.', 404);

	return user;
};
