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

import type { IRange } from '@univerjs/core';

import { BaseReferenceObject } from './base-reference-object';

export class RangeReferenceObject extends BaseReferenceObject {
    constructor(range: IRange, forcedSheetId?: string, forcedUnitId?: string) {
        super('');
        this.setRangeData(range);
        if (forcedSheetId) {
            this.setForcedSheetIdDirect(forcedSheetId);
        }

        if (forcedUnitId) {
            this.setForcedUnitIdDirect(forcedUnitId);
        }
    }

    override isRange() {
        return true;
    }
}
