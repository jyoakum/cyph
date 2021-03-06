import {Injectable} from '@angular/core';
import {BaseProvider} from '../../base-provider';
import {IPairwiseSession} from '../../crypto/castle/ipairwise-session';
import {ICastle} from '../../crypto/icastle';
import {resolvable} from '../../util/wait/resolvable';
import {SessionService} from '../session.service';

/**
 * @see ICastle
 */
@Injectable()
export class CastleService extends BaseProvider implements ICastle {
	/** @ignore */
	protected readonly pairwiseSession = resolvable<IPairwiseSession>();

	/** @see PairwiseSession.ready */
	public readonly ready = this.pairwiseSession.then(async o => o.ready);

	/** Initializes service. */
	/* eslint-disable-next-line @typescript-eslint/require-await */
	public async init (_SESSION_SERVICE: SessionService) : Promise<void> {
		throw new Error(
			'Must provide an implementation of CastleService.init.'
		);
	}

	/** @inheritDoc */
	public async receive (
		cyphertext: Uint8Array,
		initial: boolean
	) : Promise<void> {
		return (await this.pairwiseSession).receive(cyphertext, initial);
	}

	/** @inheritDoc */
	public async send (
		plaintext: string | ArrayBufferView,
		timestamp: number
	) : Promise<void> {
		return (await this.pairwiseSession).send(plaintext, timestamp);
	}

	/** Forcibly sets PairwiseSession, rather than allowing init to handle that. */
	public async setPairwiseSession (
		pairwiseSession: CastleService | IPairwiseSession
	) : Promise<void> {
		this.pairwiseSession.resolve(
			pairwiseSession instanceof CastleService ?
				await pairwiseSession.pairwiseSession :
				pairwiseSession
		);
	}

	/** Creates and returns a new instance. */
	public spawn () : CastleService {
		return new CastleService();
	}

	constructor () {
		super();
	}
}
