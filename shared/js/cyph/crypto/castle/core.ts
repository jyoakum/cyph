import {IAsyncList} from '../../iasync-list';
import {LockFunction} from '../../lock-function-type';
import {CastleRatchetState, ICastleRatchetState, ICastleRatchetUpdate} from '../../proto';
import {lockFunction} from '../../util/lock';
import {IPotassium} from '../potassium/ipotassium';


/**
 * The core Castle protocol logic.
 */
export class Core {
	/** Convert newly established shared secret into session keys. */
	public static async newSymmetricKeys (
		potassium: IPotassium,
		isAlice: boolean,
		secret: Uint8Array
	) : Promise<CastleRatchetState.SymmetricRatchetState.ISymmetricKeyPair> {
		const alt	= await potassium.hash.deriveKey(
			potassium.concatMemory(
				false,
				secret,
				new Uint8Array([1])
			),
			secret.length
		);

		return isAlice ?
			{incoming: secret, outgoing: alt} :
			{incoming: alt, outgoing: secret}
		;
	}


	/** @ignore */
	private readonly lock: LockFunction					= lockFunction();

	/** @ignore */
	private oldRatchetState?: ICastleRatchetState;

	/** @ignore */
	private readonly updateRatchetLock: LockFunction	= lockFunction();

	/** @ignore */
	private async asymmetricRatchet (incomingPublicKey?: Uint8Array) : Promise<Uint8Array> {
		let outgoingPublicKey: Uint8Array|undefined;
		let secret: Uint8Array|undefined;

		/* Part 1: Alice (outgoing) */
		if (
			this.isAlice &&
			this.potassium.isEmpty(this.ratchetState.asymmetric.privateKey) &&
			!incomingPublicKey
		) {
			const aliceKeyPair	= await this.potassium.ephemeralKeyExchange.aliceKeyPair();
			outgoingPublicKey	= aliceKeyPair.publicKey;

			this.ratchetState.asymmetric.privateKey	= aliceKeyPair.privateKey;
		}

		/* Part 2a: Bob (incoming) */
		else if (
			!this.isAlice &&
			this.potassium.isEmpty(this.ratchetState.asymmetric.publicKey) &&
			incomingPublicKey
		) {
			const secretData	= await this.potassium.ephemeralKeyExchange.bobSecret(
				incomingPublicKey
			);

			secret	= secretData.secret;

			this.ratchetState.asymmetric.publicKey	= secretData.publicKey;
		}

		/* Part 2b: Bob (outgoing) */
		else if (
			!this.isAlice &&
			!this.potassium.isEmpty(this.ratchetState.asymmetric.publicKey) &&
			!incomingPublicKey
		) {
			outgoingPublicKey	= this.ratchetState.asymmetric.publicKey;

			this.ratchetState.asymmetric.publicKey	= new Uint8Array(0);
		}

		/* Part 3: Alice (incoming) */
		else if (
			this.isAlice &&
			!this.potassium.isEmpty(this.ratchetState.asymmetric.privateKey) &&
			incomingPublicKey
		) {
			secret	= await this.potassium.ephemeralKeyExchange.aliceSecret(
				incomingPublicKey,
				this.ratchetState.asymmetric.privateKey
			);

			this.ratchetState.asymmetric.privateKey	= new Uint8Array(0);
		}

		if (secret) {
			this.ratchetState.symmetric.next	= await Core.newSymmetricKeys(
				this.potassium,
				this.isAlice,
				secret
			);
		}

		if (outgoingPublicKey) {
			return this.potassium.concatMemory(
				true,
				new Uint8Array([1]),
				outgoingPublicKey
			);
		}
		else {
			return new Uint8Array([0]);
		}
	}

	/**
	 * Pushes ratchet state update to queue.
	 */
	private async updateRatchetState (o: {
		cyphertext?: Uint8Array;
		plaintext?: Uint8Array;
	}) : Promise<void> {
		const ratchetState	= {
			asymmetric: {...this.ratchetState.asymmetric},
			incomingMessageID: this.ratchetState.incomingMessageID,
			outgoingMessageID: this.ratchetState.outgoingMessageID,
			symmetric: {
				current: {...this.ratchetState.symmetric.current},
				next: {...this.ratchetState.symmetric.next}
			}
		};

		await this.updateRatchetLock(async () => {
			if (this.oldRatchetState) {
				if (
					this.oldRatchetState.asymmetric.privateKey !==
					ratchetState.asymmetric.privateKey
				) {
					this.potassium.clearMemory(this.oldRatchetState.asymmetric.privateKey);
				}
				if (
					this.oldRatchetState.asymmetric.publicKey !==
					ratchetState.asymmetric.publicKey
				) {
					this.potassium.clearMemory(this.oldRatchetState.asymmetric.publicKey);
				}
				if (
					this.oldRatchetState.symmetric.current.incoming !==
					ratchetState.symmetric.current.incoming
				) {
					this.potassium.clearMemory(this.oldRatchetState.symmetric.current.incoming);
				}
				if (
					this.oldRatchetState.symmetric.current.outgoing !==
					ratchetState.symmetric.current.outgoing
				) {
					this.potassium.clearMemory(this.oldRatchetState.symmetric.current.outgoing);
				}
				if (
					this.oldRatchetState.symmetric.next.incoming !==
					ratchetState.symmetric.next.incoming
				) {
					this.potassium.clearMemory(this.oldRatchetState.symmetric.next.incoming);
				}
				if (
					this.oldRatchetState.symmetric.next.outgoing !==
					ratchetState.symmetric.next.outgoing
				) {
					this.potassium.clearMemory(this.oldRatchetState.symmetric.next.outgoing);
				}
			}

			this.oldRatchetState	= ratchetState;

			await this.ratchetUpdateQueue.pushItem({...o, ratchetState});
		});
	}

	/**
	 * Decrypt incoming cyphertext.
	 * @param cyphertext Data to be decrypted.
	 */
	public async decrypt (cyphertext: Uint8Array) : Promise<void> {
		const messageID	= this.potassium.toDataView(cyphertext).getUint32(0, true);

		if (this.ratchetState.incomingMessageID >= messageID) {
			return;
		}

		return this.lock(async () => {
			const ephemeralKeyExchangePublicKeyBytes	=
				await this.potassium.ephemeralKeyExchange.publicKeyBytes
			;

			if (this.ratchetState.incomingMessageID >= messageID) {
				return;
			}
			else if (messageID - this.ratchetState.incomingMessageID === 1) {
				++this.ratchetState.incomingMessageID;
			}
			else {
				throw new Error('Out of order incoming message.');
			}

			const messageIDBytes	= this.potassium.toBytes(cyphertext, 0, 4);
			const encrypted			= this.potassium.toBytes(cyphertext, 4);

			for (const keys of [
				this.ratchetState.symmetric.current,
				this.ratchetState.symmetric.next
			]) {
				try {
					const incomingKey	= await this.potassium.hash.deriveKey(keys.incoming);

					const decrypted		= await this.potassium.secretBox.open(
						encrypted,
						incomingKey,
						messageIDBytes
					);

					const startIndex	= decrypted[0] === 1 ?
						ephemeralKeyExchangePublicKeyBytes + 1 :
						1
					;

					const plaintext		= this.potassium.toBytes(decrypted, startIndex);

					keys.incoming		= incomingKey;

					if (startIndex !== 1) {
						await this.asymmetricRatchet(this.potassium.toBytes(
							decrypted,
							1,
							ephemeralKeyExchangePublicKeyBytes
						));
					}

					if (keys === this.ratchetState.symmetric.next) {
						this.ratchetState.symmetric.current	= this.ratchetState.symmetric.next;
					}

					await this.updateRatchetState({plaintext});
				}
				catch {}
			}

			throw new Error('Invalid cyphertext.');
		});
	}

	/**
	 * Encrypt outgoing plaintext.
	 * @param plaintext Data to be encrypted.
	 */
	public async encrypt (plaintext: Uint8Array) : Promise<void> {
		return this.lock(async () => {
			const messageIDBytes	=
				new Uint8Array(new Uint32Array([this.ratchetState.outgoingMessageID++]).buffer)
			;

			const ratchetData	= await this.asymmetricRatchet();
			const fullPlaintext	= this.potassium.concatMemory(false, ratchetData, plaintext);

			this.potassium.clearMemory(ratchetData);

			this.ratchetState.symmetric.current.outgoing	= await this.potassium.hash.deriveKey(
				this.ratchetState.symmetric.current.outgoing
			);

			await this.updateRatchetState({cyphertext: this.potassium.concatMemory(
				true,
				messageIDBytes,
				await this.potassium.secretBox.seal(
					fullPlaintext,
					this.ratchetState.symmetric.current.outgoing,
					messageIDBytes
				)
			)});
		});
	}

	constructor (
		/** @ignore */
		private readonly potassium: IPotassium,

		/** @ignore */
		private readonly isAlice: boolean,

		/** @ignore */
		private readonly ratchetState: ICastleRatchetState,

		/** @ignore */
		private readonly ratchetUpdateQueue: IAsyncList<ICastleRatchetUpdate>
	) {}
}
