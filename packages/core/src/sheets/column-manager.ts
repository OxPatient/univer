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

import type { Nullable } from '../common/type-utils';
import type { IObjectArrayPrimitiveType } from '../shared/object-matrix';
import { getArrayLength } from '../shared/object-matrix';
import { BooleanNumber } from '../types/enum';
import type { IColumnData, IRange, IWorksheetData } from '../types/interfaces';
import { RANGE_TYPE } from '../types/interfaces';

/**
 * Manage configuration information of all columns, get column width, column length, set column width, etc.
 */
export class ColumnManager {
    private _columnData: IObjectArrayPrimitiveType<Partial<IColumnData>> = {};

    constructor(
        private readonly _config: IWorksheetData,
        data: IObjectArrayPrimitiveType<Partial<IColumnData>>
    ) {
        this._columnData = data;
    }

    /**
     * Get width and hidden status of columns in the sheet
     * @returns
     */
    getColumnData(): IObjectArrayPrimitiveType<Partial<IColumnData>> {
        return this._columnData;
    }

    getColVisible(colPos: number): boolean {
        const { _columnData } = this;
        const col = _columnData[colPos];
        if (!col) {
            return true;
        }
        return col.hd !== BooleanNumber.TRUE;
    }

    getHiddenCols(start: number = 0, end: number = getArrayLength(this._columnData) - 1): IRange[] {
        const hiddenCols: IRange[] = [];

        let inHiddenRange = false;
        let startColumn = -1;

        for (let i = start; i <= end; i++) {
            const visible = this.getColVisible(i);
            if (inHiddenRange && visible) {
                inHiddenRange = false;
                hiddenCols.push({
                    rangeType: RANGE_TYPE.COLUMN,
                    startColumn,
                    endColumn: i - 1,
                    startRow: 0,
                    endRow: 0,
                });
            } else if (!inHiddenRange && !visible) {
                inHiddenRange = true;
                startColumn = i;
            }
        }

        if (inHiddenRange) {
            hiddenCols.push({
                startRow: 0,
                endRow: 0,
                startColumn,
                endColumn: end,
                rangeType: RANGE_TYPE.COLUMN,
            });
        }

        return hiddenCols;
    }

    getColumnDatas(columnPos: number, numColumns: number): IObjectArrayPrimitiveType<Partial<IColumnData>> {
        const columnData: IObjectArrayPrimitiveType<Partial<IColumnData>> = {};
        let index = 0;
        for (let i = columnPos; i < columnPos + numColumns; i++) {
            const data = this.getColumnOrCreate(i);
            columnData[index] = data;
            index++;
        }
        return columnData;
    }

    /**
     * Get count of column in the sheet
     * @returns
     */
    getSize(): number {
        return getArrayLength(this._columnData);
    }

    /**
     * Get the width of column
     * @param columnPos column index
     * @returns
     */
    getColumnWidth(columnPos: number): number {
        const { _columnData } = this;
        const config = this._config;
        let width: number = 0;

        const column = _columnData[columnPos] || {
            hd: BooleanNumber.FALSE,
            w: config.defaultColumnWidth,
        };
        width = column.w || config.defaultColumnWidth;

        return width;
    }

    /**
     * get given column data
     * @param columnPos column index
     * @returns
     */
    getColumn(columnPos: number): Nullable<Partial<IColumnData>> {
        const column = this._columnData[columnPos];
        if (column) {
            return column;
        }
    }

    /**
     * get given column data or create a column data when it's null
     * @param columnPos column index
     * @returns
     */
    getColumnOrCreate(columnPos: number): Partial<IColumnData> {
        const { _columnData } = this;
        const config = this._config;
        const column = _columnData[columnPos];
        if (column) {
            return column;
        }
        const create = {
            w: config.defaultColumnWidth,
            hd: BooleanNumber.FALSE,
        };
        this._columnData[columnPos] = create;
        return create;
    }
}
