import {Injectable} from '@angular/core';
import {switchMap} from 'rxjs/operators';
import {SecurityModels} from '../account';
import {BaseProvider} from '../base-provider';
import {IAsyncValue} from '../iasync-value';
import {IFile} from '../ifile';
import {BinaryProto, CyphPlans, InvertedBooleanProto} from '../proto';
import {toBehaviorSubject} from '../util/flatten-observable';
import {AccountDatabaseService} from './crypto/account-database.service';
import {FileService} from './file.service';
import {StringsService} from './strings.service';

/**
 * Account settings service.
 */
@Injectable()
export class AccountSettingsService extends BaseProvider {
	/** User-set flags to enable/disable features. */
	public readonly featureFlags = {
		files: this.getFeatureFlag('files'),
		forms: this.getFeatureFlag('forms'),
		inbox: this.getFeatureFlag('inbox'),
		invite: this.getFeatureFlag('invite'),
		messaging: this.getFeatureFlag('messaging'),
		notes: this.getFeatureFlag('notes'),
		passwords: this.getFeatureFlag('passwords'),
		social: this.getFeatureFlag('social'),
		wallets: this.getFeatureFlag('wallets')
	};

	/** List of feature flags. */
	public readonly featureFlagsList = [
		{
			featureFlag: this.featureFlags.files,
			id: 'files',
			label: this.stringsService.featureFlagsFiles
		},
		{
			featureFlag: this.featureFlags.forms,
			id: 'forms',
			label: this.stringsService.featureFlagsForms
		},
		{
			featureFlag: this.featureFlags.inbox,
			id: 'inbox',
			label: this.stringsService.featureFlagsInbox
		},
		{
			featureFlag: this.featureFlags.invite,
			id: 'invite',
			label: this.stringsService.featureFlagsInvite
		},
		{
			featureFlag: this.featureFlags.messaging,
			id: 'messaging',
			label: this.stringsService.featureFlagsMessaging
		},
		{
			featureFlag: this.featureFlags.notes,
			id: 'notes',
			label: this.stringsService.featureFlagsNotes
		},
		{
			featureFlag: this.featureFlags.passwords,
			id: 'passwords',
			label: this.stringsService.featureFlagsPasswords
		},
		{
			featureFlag: this.featureFlags.social,
			id: 'social',
			label: this.stringsService.featureFlagsSocial
		},
		{
			featureFlag: this.featureFlags.wallets,
			id: 'wallets',
			label: this.stringsService.featureFlagsWallets
		}
	];

	/** User's plan / premium status. */
	public readonly plan = toBehaviorSubject(
		this.accountDatabaseService.currentUserFiltered.pipe(
			switchMap(o => o.user.plan)
		),
		CyphPlans.Free,
		this.subscriptions
	);

	/** @ignore */
	private getFeatureFlag (featureFlag: string) : IAsyncValue<boolean> {
		return this.accountDatabaseService.getAsyncValue(
			`featureFlags/${featureFlag}`,
			InvertedBooleanProto,
			SecurityModels.unprotected,
			undefined,
			undefined,
			undefined,
			this.subscriptions
		);
	}

	/** @ignore */
	private async setImage (
		file: IFile,
		prop: 'avatar' | 'coverImage'
	) : Promise<void> {
		await this.accountDatabaseService.setItem(
			prop,
			BinaryProto,
			await this.fileService.getBytes(file, true),
			SecurityModels.public
		);
	}

	/** Sets the currently signed in user's avatar. */
	public async setAvatar (file: IFile) : Promise<void> {
		return this.setImage(file, 'avatar');
	}

	/** Sets the currently signed in user's cover image. */
	public async setCoverImage (file: IFile) : Promise<void> {
		return this.setImage(file, 'coverImage');
	}

	constructor (
		/** @ignore */
		private readonly accountDatabaseService: AccountDatabaseService,

		/** @ignore */
		private readonly fileService: FileService,

		/** @ignore */
		private readonly stringsService: StringsService
	) {
		super();
	}
}
