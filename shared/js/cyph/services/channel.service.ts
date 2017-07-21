import {Injectable} from '@angular/core';
import {ChannelMessage} from '../../proto';
import {IAsyncValue} from '../iasync-value';
import {IProto} from '../iproto';
import {LockFunction} from '../lock-function-type';
import {StringProto} from '../protos';
import {IChannelHandlers} from '../session';
import {util} from '../util';
import {DatabaseService} from './database.service';


/**
 * Bidirectional network connection that sends and receives data.
 */
@Injectable()
export class ChannelService {
	/** @ignore */
	private isClosed: boolean	= false;

	/** @ignore */
	private readonly localLock: LockFunction	= util.lockFunction();

	/** @ignore */
	private resolveState: (state: {lock: LockFunction; url: string}) => void;

	/** @ignore */
	private readonly state: Promise<{lock: LockFunction; url: string}>	=
		new Promise<{lock: LockFunction; url: string}>(resolve => {
			this.resolveState	= resolve;
		})
	;

	/** @ignore */
	private readonly userID: string	= util.uuid();

	/** This kills the channel. */
	public async close () : Promise<void> {
		if (this.isClosed) {
			return;
		}

		this.isClosed	= true;

		await this.databaseService.removeItem((await this.state).url);
	}

	/** @see DatabaseService.getAsyncValue */
	public async getAsyncValue<T> (url: string, proto: IProto<T>) : Promise<IAsyncValue<T>> {
		return this.databaseService.getAsyncValue(`${(await this.state).url}/${url}`, proto);
	}

	/**
	 * Initializes service.
	 * @param channelName Name of this channel.
	 * @param handlers Event handlers for this channel.
	 */
	public async init (channelName: string, handlers: IChannelHandlers) : Promise<void> {
		const url	= `channels/${channelName}`;

		this.resolveState({lock: this.databaseService.lockFunction(`${url}/lock`), url});
		this.databaseService.setDisconnectTracker(`${url}/disconnects/${this.userID}`);

		let isConnected	= false;
		const usersSubscription	= this.databaseService.watchList(
			`${url}/users`,
			StringProto
		).subscribe(
			users => {
				if (users.length < 1) {
					return;
				}
				if (!isConnected) {
					isConnected	= true;
					handlers.onOpen(users[0].value === this.userID);
				}
				if (users.length < 2) {
					return;
				}
				usersSubscription.unsubscribe();
				handlers.onConnect();
			},
			err => {
				handlers.onClose();
				throw err;
			}
		);

		this.databaseService.watchListPushes(
			`${url}/messages`,
			ChannelMessage,
			true,
			true
		).subscribe(
			message => {
				if (message.value.author !== this.userID) {
					handlers.onMessage(message.value.cyphertext);
				}
			},
			err => {
				handlers.onClose();
				throw err;
			},
			() => {
				handlers.onClose();
			}
		);

		this.databaseService.pushItem(`${url}/users`, StringProto, this.userID);
	}

	/** Indicates whether this channel is available for sending and receiving. */
	public get isAlive () : boolean {
		return !this.isClosed;
	}

	/** @see DatabaseService.lock */
	public async lock<T> (f: (reason?: string) => Promise<T>, reason?: string) : Promise<T> {
		return (await this.state).lock(f, reason);
	}

	/** Sends message through this channel. */
	public send (cyphertext: Uint8Array) : void {
		this.localLock(async () => this.databaseService.pushItem(
			`${(await this.state).url}/messages`,
			ChannelMessage,
			{author: this.userID, cyphertext}
		));
	}

	constructor (
		/** @ignore */
		private readonly databaseService: DatabaseService
	) {}
}
