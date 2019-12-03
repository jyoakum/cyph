import {CommonModule} from '@angular/common';
import {HttpClientModule} from '@angular/common/http';
import {NgModule} from '@angular/core';
import {FlexLayoutModule} from '@angular/flex-layout';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSelectModule} from '@angular/material/select';
import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MarkdownComponent} from '../components/markdown';
import {AnchorDirective} from '../directives/anchor.directive';
import {AutofocusDirective} from '../directives/autofocus.directive';
import {EnableLastPassDirective} from '../directives/enable-last-pass.directive';
import {NanoScrollerDirective} from '../directives/nano-scroller.directive';
import {RouterLinkDirective} from '../directives/router-link.directive';
import {TranslateDirective} from '../directives/translate.directive';
import {AffiliateService} from '../services/affiliate.service';
import {ConfigService} from '../services/config.service';
import {EnvService} from '../services/env.service';
import {SplitTestingService} from '../services/split-testing.service';
import {StringsService} from '../services/strings.service';

/**
 * Common module shared by cyph.com and CyphWebModule.
 */
@NgModule({
	declarations: [
		AnchorDirective,
		AutofocusDirective,
		EnableLastPassDirective,
		MarkdownComponent,
		NanoScrollerDirective,
		RouterLinkDirective,
		TranslateDirective
	],
	exports: [
		AnchorDirective,
		AutofocusDirective,
		BrowserAnimationsModule,
		BrowserModule,
		CommonModule,
		EnableLastPassDirective,
		FlexLayoutModule,
		FormsModule,
		HttpClientModule,
		MarkdownComponent,
		MatButtonModule,
		MatCheckboxModule,
		MatInputModule,
		MatProgressSpinnerModule,
		MatSelectModule,
		NanoScrollerDirective,
		RouterLinkDirective,
		TranslateDirective
	],
	imports: [
		BrowserAnimationsModule,
		BrowserModule,
		CommonModule,
		FlexLayoutModule,
		FormsModule,
		HttpClientModule,
		MatButtonModule,
		MatCheckboxModule,
		MatInputModule,
		MatProgressSpinnerModule,
		MatSelectModule
	],
	providers: [
		AffiliateService,
		ConfigService,
		EnvService,
		SplitTestingService,
		StringsService,
		{
			provide: 'EnvService',
			useExisting: EnvService
		}
	]
})
export class CyphSharedModule {
	constructor () {}
}
