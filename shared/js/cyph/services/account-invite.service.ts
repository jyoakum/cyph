import {Injectable} from '@angular/core';
import {SafeUrl} from '@angular/platform-browser';
import {map} from 'rxjs/operators';
import {SecurityModels} from '../account';
import {BaseProvider} from '../base-provider';
import {BooleanProto} from '../proto';
import {toBehaviorSubject} from '../util/flatten-observable';
import {AccountDatabaseService} from './crypto/account-database.service';
import {DatabaseService} from './database.service';
import {DialogService} from './dialog.service';
import {EnvService} from './env.service';
import {QRService} from './qr.service';
import {StringsService} from './strings.service';

/**
 * Angular service for managing Accounts invites.
 */
@Injectable()
export class AccountInviteService extends BaseProvider {
	/** @ignore */
	private readonly codes = this.accountDatabaseService.getAsyncMap(
		'inviteCodes',
		BooleanProto,
		SecurityModels.unprotected
	);

	/** Number of available invites. */
	public readonly count = toBehaviorSubject(
		this.codes.watchKeys().pipe(map(arr => arr.length)),
		0
	);

	/** Gets an invite URL. */
	public async getInviteURL () : Promise<{
		qrCode: () => Promise<SafeUrl>;
		url: string;
	}> {
		const inviteCode = (await this.codes.getKeys())[0];
		if (!inviteCode) {
			throw new Error('No invite codes available.');
		}

		await this.codes.removeItem(inviteCode);

		const url = `${this.envService.appUrl}register/${inviteCode}`;

		return {
			qrCode: async () =>
				this.qrService.getQRCode({
					dotScale: 0.75,
					size: 250,
					text: url
				}),
			url
		};
	}

	/** Sends an invite link. */
	public async send (email: string, name?: string) : Promise<void> {
		await this.databaseService.callFunction('sendInvite', {email, name});
	}

	/** Displays invite link to user. */
	public async showInviteURL () : Promise<void> {
		const invite = await this.getInviteURL();

		return this.dialogService.alert({
			content: invite.url,
			markdown: true,
			title: this.stringsService.inviteLinkTitle
		});
	}

	constructor (
		/** @ignore */
		private readonly accountDatabaseService: AccountDatabaseService,

		/** @ignore */
		private readonly databaseService: DatabaseService,

		/** @ignore */
		private readonly dialogService: DialogService,

		/** @ignore */
		private readonly envService: EnvService,

		/** @ignore */
		private readonly qrService: QRService,

		/** @ignore */
		private readonly stringsService: StringsService
	) {
		super();
	}
}
