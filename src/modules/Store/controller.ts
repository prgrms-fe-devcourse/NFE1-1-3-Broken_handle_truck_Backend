import { NextFunction, Request, Response } from 'express';
import {
	deleteStore,
	getStore,
	getStoreById,
	getStores,
	postStore,
} from './service';
import { Types } from 'mongoose';
import { IStore } from '@/models/Store';
import { AppError } from '@/utils';

export const getStoresController = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { lat, lon, category, name } = req.query;

		if (!lat || !lon)
			throw new AppError('위도, 경도 정보가 누락된 요청입니다.', 400);

		const stores = await getStores(
			Number(lat),
			Number(lon),
			category as string,
			name as string,
		);

		res.status(200).json({
			msg: 'ok',
			stores,
		});
	} catch (error) {
		next(error);
	}
};

export const postStoreController = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const user = req.user;
		const { name, coordinates, category, paymentMethod } = req.body;

		if (!user)
			throw new AppError(
				'사용자 인증 정보가 없습니다. 잘못된 접근입니다.',
				401,
			);

		if (!coordinates || !category || !paymentMethod || !name)
			throw new AppError('가게 등록을 위한 정보가 누락된 요청입니다.', 400);

		const data: IStore = {
			name,
			ownerId: new Types.ObjectId(user._id),
			coordinates,
			category,
			paymentMethod,
		};

		const { store, comments } = await postStore(data);

		res.status(201).json({
			msg: 'ok',
			store,
			comments,
		});
	} catch (error) {
		next(error);
	}
};

export const getStoreController = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const user = req.user;

		if (!user)
			throw new AppError(
				'사용자 인증 정보가 없습니다. 잘못된 접근입니다.',
				401,
			);

		const { store, comments } = await getStore(user._id);
		res.status(200).json({
			msg: 'ok',
			store,
			comments,
		});
	} catch (error) {
		next(error);
	}
};

export const deleteStoreController = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const user = req.user;

		if (!user)
			throw new AppError(
				'사용자 인증 정보가 없습니다. 잘못된 접근입니다.',
				401,
			);

		await deleteStore(user._id);
		res.status(200).json({
			msg: 'ok',
		});
	} catch (e) {
		next(e);
	}
};

export const getStoreByIdController = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	try {
		const { storeId } = req.params;
		if (!storeId) throw new AppError('storeId 정보가 누락되었습니다.', 400);

		const { store, comments } = await getStoreById(storeId as string);

		res.status(200).json({
			msg: 'ok',
			store,
			comments,
		});
	} catch (e) {
		next(e);
	}
};
