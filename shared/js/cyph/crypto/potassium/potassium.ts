import {Box} from './box';
import {EphemeralKeyExchange} from './ephemeral-key-exchange';
import {Hash} from './hash';
import * as NativeCrypto from './native-crypto';
import {OneTimeAuth} from './one-time-auth';
import {PasswordHash} from './password-hash';
import {PotassiumUtil, potassiumUtil} from './potassium-util';
import {SecretBox} from './secret-box';
import {Sign} from './sign';


/**
 * libsodium-inspired wrapper for the post-quantum primitives used by Cyph.
 * Outside of this class, libsodium and other cryptographic implementations
 * should generally not be called directly.
 */
export class Potassium extends PotassiumUtil {
	/** Indicates whether native crypto API is supported in this environment. */
	public static async isNativeCryptoSupported () : Promise<boolean> {
		try {
			await NativeCrypto.secretBox.seal(
				potassiumUtil.randomBytes(1),
				potassiumUtil.randomBytes(NativeCrypto.secretBox.nonceBytes),
				potassiumUtil.randomBytes(NativeCrypto.secretBox.keyBytes)
			);
			return true;
		}
		catch (_) {
			return false;
		}
	}


	/** @see Box */
	public readonly box: Box;

	/** @see EphemeralKeyExchange */
	public readonly ephemeralKeyExchange: EphemeralKeyExchange;

	/** @see Hash */
	public readonly hash: Hash;

	/** @see OneTimeAuth */
	public readonly oneTimeAuth: OneTimeAuth;

	/** @see PasswordHash */
	public readonly passwordHash: PasswordHash;

	/** @see SecretBox */
	public readonly secretBox: SecretBox;

	/** @see Sign */
	public readonly sign: Sign;

	/** Indicates whether this Potassium instance is using native crypto. */
	public native () : boolean {
		return this.isNative;
	}

	/**
	 * @param isNative If true, will use NativeCrypto instead of libsodium.
	 * @param counter Initial value of counter for nonces.
	 */
	constructor (
		/** @ignore */
		private readonly isNative: boolean = false,

		/** @ignore */
		private counter: number = 0
	) {
		super();

		this.hash					= new Hash(this.isNative);
		this.oneTimeAuth			= new OneTimeAuth(this.isNative);
		this.secretBox				= new SecretBox(this.isNative, this.counter);
		this.sign					= new Sign();

		this.box					= new Box(this.isNative, this.oneTimeAuth, this.secretBox);
		this.ephemeralKeyExchange	= new EphemeralKeyExchange(this.hash);
		this.passwordHash			= new PasswordHash(this.isNative, this.secretBox);
	}
}
