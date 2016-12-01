import {Analytics} from '../analytics';
import {Env} from '../env';
import {EventManager} from '../eventmanager';
import {Command} from '../session/command';
import {Events, rpcEvents} from '../session/enums';
import {IMutex} from '../session/imutex';
import {ISession} from '../session/isession';
import {Message} from '../session/message';
import {Mutex} from '../session/mutex';
import {Util} from '../util';
import {UIEventCategories, UIEvents} from './enums';
import {IP2P} from './ip2p';


/** @inheritDoc */
export class P2P implements IP2P {
	/** Constant values used by P2P. */
	public static readonly constants	= {
		accept: 'accept',
		audio: 'audio',
		decline: 'decline',
		kill: 'kill',
		requestCall: 'requestCall',
		video: 'video',
		webRTC: 'webRTC'
	};

	/** Indicates whether WebRTC is supported in the current environment. */
	public static readonly isSupported: boolean	= (() => {
		try {
			return new (<any> self).SimpleWebRTC({
				connection: {on: () => {}}
			}).capabilities.support;
		}
		catch (_) {
			return false;
		}
	})();


	/** @ignore */
	private isAccepted: boolean;

	/** @ignore */
	private readonly mutex: IMutex;

	/** @ignore */
	private webRTC: any;

	/** @ignore */
	private readonly commands	= {
		accept: () : void => {
			this.join();
		},

		decline: () : void => {
			this.isAccepted	= false;

			this.triggerUIEvent(
				UIEventCategories.request,
				UIEvents.requestRejection
			);
		},

		kill: async () : Promise<void> => {
			const wasAccepted: boolean	= this.isAccepted;
			this.isAccepted				= false;
			this.isActive				= false;

			await Util.sleep(500);

			this.incomingStream.audio	= false;
			this.incomingStream.video	= false;
			this.outgoingStream.audio	= false;
			this.outgoingStream.video	= false;

			if (this.webRTC && this.webRTC.mute) {
				this.webRTC.mute();
				this.webRTC.pauseVideo();
				this.webRTC.stopLocalVideo();
				this.webRTC.leaveRoom();
				this.webRTC.disconnect();
				this.webRTC	= null;
			}

			if (wasAccepted) {
				this.triggerUIEvent(
					UIEventCategories.base,
					UIEvents.connected,
					false
				);
			}
		},

		webRTC: (data: {event: string; args: any[]}) : void => {
			EventManager.trigger(
				P2P.constants.webRTC + data.event,
				data.args
			);
		}
	};

	/** @inheritDoc */
	public readonly incomingStream	= {audio: false, video: false};

	/** @inheritDoc */
	public readonly outgoingStream	= {audio: false, video: false};

	/** @inheritDoc */
	public isActive: boolean;

	/** @inheritDoc */
	public loading: boolean;

	/** @ignore */
	private receiveCommand (command: Command) : void {
		if (!P2P.isSupported) {
			return;
		}

		if (this.isAccepted && command.method in this.commands) {
			(<any> this.commands)[command.method](command.argument);
		}
		else if (
			command.method === P2P.constants.video ||
			command.method === P2P.constants.audio
		) {
			this.triggerUIEvent(
				UIEventCategories.request,
				UIEvents.acceptConfirm,
				command.method,
				500000,
				this.isAccepted,
				(ok: boolean) => {
					this.session.send(
						new Message(
							rpcEvents.p2p,
							new Command(ok ?
								P2P.constants.accept :
								P2P.constants.decline
							)
						)
					);

					if (ok) {
						this.accept(command.method);
						this.join();

						Analytics.send({
							eventAction: 'start',
							eventCategory: 'call',
							eventLabel: command.method,
							eventValue: 1,
							hitType: 'event'
						});
					}
				}
			);
		}
	}

	/** @ignore */
	private refresh (webRTC: any = this.webRTC) : void {
		this.loading	=
			this.incomingStream.audio ||
			this.incomingStream.video
		;

		if (!webRTC) {
			return;
		}

		webRTC.leaveRoom();
		webRTC.stopLocalVideo();
		webRTC.startLocalVideo();
	}

	/** @ignore */
	private triggerUIEvent(
		category: UIEventCategories,
		event: UIEvents,
		...args: any[]
	) : void {
		this.session.trigger(Events.p2pUI, {category, event, args});
	}

	/** @inheritDoc */
	public accept (callType?: string) : void {
		this.isAccepted				= true;
		this.outgoingStream.video	= callType === P2P.constants.video;
		this.outgoingStream.audio	= true;
	}

	/** @inheritDoc */
	public close () : void {
		this.session.send(
			new Message(
				rpcEvents.p2p,
				new Command(P2P.constants.kill)
			)
		);

		this.commands.kill();
	}

	/** @inheritDoc */
	public async join () : Promise<void> {
		if (this.webRTC) {
			return;
		}

		this.webRTC		= {};

		this.loading	= true;

		this.incomingStream.audio	= this.outgoingStream.audio;
		this.incomingStream.video	= this.outgoingStream.video;

		this.isActive	= true;

		const iceServers: string	= await Util.request({
			retries: 5,
			url: Env.baseUrl + 'iceservers'
		});

		const events: string[]	= [];

		const webRTC	= new (<any> self).SimpleWebRTC({
			adjustPeerVolume: true,
			autoRemoveVideos: false,
			autoRequestMedia: false,
			connection: {
				disconnect: () => events.forEach(event => EventManager.off(event)),
				emit: (event: string, ...args: any[]) => {
					const lastArg: any	= args.slice(-1)[0];

					if (event === 'join' && typeof lastArg === 'function') {
						lastArg(null, {clients: {friend: {video: true}}});
					}
					else {
						this.session.send(
							new Message(
								rpcEvents.p2p,
								new Command(
									P2P.constants.webRTC,
									{event, args}
								)
							)
						);
					}
				},
				getSessionid: () => this.session.state.cyphId,
				on: (event: string, callback: Function) => {
					const fullEvent: string	= P2P.constants.webRTC + event;
					events.push(fullEvent);

					EventManager.on(
						fullEvent,
						(args: any) => {
							/* http://www.kapejod.org/en/2014/05/28/ */
							if (event === 'message' && args[0].type === 'offer') {
								args[0].payload.sdp	= args[0].payload.sdp.
									split('\n').
									filter((line: string) =>
										line.indexOf('b=AS:') < 0 &&
										line.indexOf(
											'urn:ietf:params:rtp-hdrext:ssrc-audio-level'
										) < 0
									).
									join('\n')
								;
							}

							callback.apply(webRTC, args);
						}
					);
				}
			},
			localVideoEl: this.localVideo()[0],
			media: this.outgoingStream,
			remoteVideosEl: this.remoteVideo()[0]
		});

		webRTC.webrtc.config.peerConnectionConfig.iceServers	=
			JSON.parse(iceServers).
			filter((o: any) => !this.forceTURN || o.url.indexOf('stun:') !== 0)
		;

		webRTC.connection.on(
			'streamUpdate',
			(incomingStream: {audio: boolean; video: boolean}) => {
				this.incomingStream.audio	= !!incomingStream.audio;
				this.incomingStream.video	= !!incomingStream.video;
				this.refresh(webRTC);
			}
		);

		webRTC.on('videoAdded', () => {
			this.remoteVideo().find('video').slice(0, -1).remove();

			this.loading	= false;
		});

		webRTC.on('readyToCall', () => webRTC.joinRoom(P2P.constants.webRTC));
		webRTC.startLocalVideo();
		webRTC.connection.emit('connect');

		this.webRTC	= webRTC;

		/* Temporary workaround */
		if (this.session.state.isAlice) {
			await Util.sleep(5000);
			this.refresh();
		}
	}

	/** @inheritDoc */
	public request (callType: string) : void {
		this.triggerUIEvent(
			UIEventCategories.request,
			UIEvents.requestConfirm,
			callType,
			this.isAccepted,
			async (ok: boolean) => {
				if (!ok) {
					return;
				}

				const lockDetails	= await this.mutex.lock(P2P.constants.requestCall);

				try {
					if (!lockDetails.wasFirstOfType) {
						return;
					}

					this.accept(callType);

					this.session.send(
						new Message(
							rpcEvents.p2p,
							new Command(callType)
						)
					);

					await Util.sleep();
					this.triggerUIEvent(
						UIEventCategories.request,
						UIEvents.requestConfirmation
					);

					/* Time out if request hasn't been accepted within 10 minutes */
					await Util.sleep(600000);
					if (!this.isActive) {
						this.isAccepted	= false;
					}
				}
				finally {
					this.mutex.unlock();
				}
			}
		);
	}

	/** @inheritDoc */
	public toggle (shouldPause?: boolean, medium?: string) : void {
		if (!this.webRTC) {
			return;
		}

		if (shouldPause !== true && shouldPause !== false) {
			if (medium) {
				(<any> this.outgoingStream)[medium]	= !(<any> this.outgoingStream)[medium];
			}
			else {
				this.outgoingStream.audio	= !this.outgoingStream.audio;
				this.outgoingStream.video	= !this.outgoingStream.video;
			}
		}
		else if (medium) {
			(<any> this.outgoingStream)[medium]	= !shouldPause;
		}
		else {
			this.outgoingStream.audio	= !shouldPause;
			this.outgoingStream.video	= !shouldPause;
		}

		this.webRTC.connection.emit('streamUpdate', this.outgoingStream);
		this.refresh();
	}

	constructor (
		/** @ignore */
		private readonly session: ISession,

		/** @ignore */
		private readonly forceTURN: boolean,

		/** @ignore */
		private readonly localVideo: () => JQuery,

		/** @ignore */
		private readonly remoteVideo: () => JQuery
	) {
		this.mutex	= new Mutex(this.session);

		if (P2P.isSupported) {
			this.session.on(Events.beginChat, () => this.session.send(
				new Message(rpcEvents.p2p, new Command())
			));
		}

		this.session.on(Events.closeChat, () => this.close());

		this.session.on(rpcEvents.p2p, (command: Command) => {
			if (command.method) {
				this.receiveCommand(command);
			}
			else if (P2P.isSupported) {
				this.triggerUIEvent(
					UIEventCategories.base,
					UIEvents.enable
				);
			}
		});
	}
}
