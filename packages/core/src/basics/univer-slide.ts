/**
 * Copyright 2023-present DreamNum Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Inject, Injector } from '@wendellhu/redi';

import { LifecycleInitializerService, LifecycleService } from '../services/lifecycle/lifecycle.service';
import { Slide } from '../slides/domain/slide-model';
import type { ISlideData } from '../types/interfaces/i-slide-data';
import { PluginHolder } from './plugin-holder';

/**
 * Externally provided UniverSlide root instance
 */
export class UniverSlide extends PluginHolder {
    constructor(
        @Inject(Injector) protected readonly _injector: Injector,
        @Inject(LifecycleService) protected readonly _lifecycleService: LifecycleService,
        @Inject(LifecycleInitializerService)
        protected readonly _lifecycleInitializerService: LifecycleInitializerService
    ) {
        super();
    }

    createSlide(data: Partial<ISlideData>): Slide {
        const slide = this._injector.createInstance(Slide, data);
        return slide;
    }
}
