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

import type { IRange } from '../types/interfaces/i-range';
import { RANGE_TYPE } from '../types/interfaces/i-range';
import type { Nullable } from './types';

/**
 * This class provides a set of methods to calculate `IRange`.
 */
export class Rectangle {
    static clone(src: IRange): IRange {
        return {
            startRow: src.startRow,
            startColumn: src.startColumn,
            endRow: src.endRow,
            endColumn: src.endColumn,
            rangeType: src.rangeType,
        };
    }

    static equals(src: IRange, target: IRange): boolean {
        return (
            src.endRow === target.endRow &&
            src.endColumn === target.endColumn &&
            src.startRow === target.startRow &&
            src.startColumn === target.startColumn &&
            (src.rangeType === target.rangeType ||
                (src.rangeType === undefined && target.rangeType === RANGE_TYPE.NORMAL) ||
                (target.rangeType === undefined && src.rangeType === RANGE_TYPE.NORMAL))
        );
    }

    static intersects(src: IRange, target: IRange): boolean {
        const currentStartRow = src.startRow;
        const currentEndRow = src.endRow;
        const currentStartColumn = src.startColumn;
        const currentEndColumn = src.endColumn;

        const incomingStartRow = target.startRow;
        const incomingEndRow = target.endRow;
        const incomingStartColumn = target.startColumn;
        const incomingEndColumn = target.endColumn;

        const zx = Math.abs(currentStartColumn + currentEndColumn - incomingStartColumn - incomingEndColumn);
        const x = Math.abs(currentStartColumn - currentEndColumn) + Math.abs(incomingStartColumn - incomingEndColumn);
        const zy = Math.abs(currentStartRow + currentEndRow - incomingStartRow - incomingEndRow);
        const y = Math.abs(currentStartRow - currentEndRow) + Math.abs(incomingStartRow - incomingEndRow);

        return zx <= x && zy <= y;
    }

    static getIntersects(src: IRange, target: IRange): Nullable<IRange> {
        const currentStartRow = src.startRow;
        const currentEndRow = src.endRow;
        const currentStartColumn = src.startColumn;
        const currentEndColumn = src.endColumn;

        const incomingStartRow = target.startRow;
        const incomingEndRow = target.endRow;
        const incomingStartColumn = target.startColumn;
        const incomingEndColumn = target.endColumn;

        let startColumn;
        let startRow;
        let endColumn;
        let endRow;
        if (incomingStartRow <= currentEndRow) {
            if (incomingStartRow >= currentStartRow) {
                startRow = incomingStartRow;
            } else {
                startRow = currentStartRow;
            }
        } else {
            return null;
        }

        if (incomingEndRow >= currentStartRow) {
            if (incomingEndRow >= currentEndRow) {
                endRow = currentEndRow;
            } else {
                endRow = incomingEndRow;
            }
        } else {
            return null;
        }

        if (incomingStartColumn <= currentEndColumn) {
            if (incomingStartColumn > currentStartColumn) {
                startColumn = incomingStartColumn;
            } else {
                startColumn = currentStartColumn;
            }
        } else {
            return null;
        }

        if (incomingEndColumn >= currentStartColumn) {
            if (incomingEndColumn >= currentEndColumn) {
                endColumn = currentEndColumn;
            } else {
                endColumn = incomingEndColumn;
            }
        } else {
            return null;
        }

        return {
            startRow,
            endRow,
            startColumn,
            endColumn,
            rangeType: RANGE_TYPE.NORMAL, // TODO: this may not be accurate
        };
    }

    // static subtract(src: IRange, target: IRange): Nullable<IRange[]> {
    //     const intersected = Rectangle.getIntersects(src, target);
    //     if (!intersected) {
    //         return [src];
    //     }

    //     const result: IRange[] = [];
    //     const { startRow, endRow, startColumn, endColumn } = intersected;
    //     const { startRow: srcStartRow, endRow: srcEndRow, startColumn: srcStartColumn, endColumn: srcEndColumn } = src;

    //     // subtract could result in eight pieces and these eight pieces and be merged to at most four pieces
    // }

    static contains(src: IRange, target: IRange): boolean {
        return (
            src.startRow <= target.startRow &&
            src.endRow >= target.endRow &&
            src.startColumn <= target.startColumn &&
            src.endColumn >= target.endColumn
        );
    }

    static realContain(src: IRange, target: IRange): boolean {
        return (
            Rectangle.contains(src, target) &&
            (src.startRow < target.startRow ||
                src.endRow > target.endRow ||
                src.startColumn < target.startColumn ||
                src.endColumn > target.endColumn)
        );
    }

    static union(...ranges: IRange[]): IRange {
        // TODO: range type may not be accurate
        return ranges.reduce(
            (acc, current) => ({
                startRow: Math.min(acc.startRow, current.startRow),
                startColumn: Math.min(acc.startColumn, current.startColumn),
                endRow: Math.max(acc.endRow, current.endRow),
                endColumn: Math.max(acc.endColumn, current.endColumn),
                rangeType: RANGE_TYPE.NORMAL,
            }),
            ranges[0]
        );
    }
    static getRelativeRange = (range: IRange, originRange: IRange) =>
        ({
            startRow: range.startRow - originRange.startRow,
            endRow: range.endRow - range.startRow,
            startColumn: range.startColumn - originRange.startColumn,
            endColumn: range.endColumn - range.startColumn,
        }) as IRange;

    static getPositionRange = (relativeRange: IRange, originRange: IRange) =>
        ({
            startRow: relativeRange.startRow + originRange.startRow,
            endRow: relativeRange.endRow + relativeRange.startRow + originRange.startRow,
            startColumn: relativeRange.startColumn + originRange.startColumn,
            endColumn: relativeRange.endColumn + relativeRange.startColumn + originRange.startColumn,
        }) as IRange;

    static moveHorizontal = (range: IRange, step: number = 0, length: number = 0): IRange => ({
        ...range,
        startColumn: range.startColumn + step,
        endColumn: range.endColumn + step + length,
    });

    static moveVertical = (range: IRange, step: number = 0, length: number = 0): IRange => ({
        ...range,
        startRow: range.startRow + step,
        endRow: range.endRow + step + length,
    });

    static moveOffset = (range: IRange, offsetX: number, offsetY: number): IRange => ({
        ...range,
        startRow: range.startRow + offsetY,
        endRow: range.endRow + offsetY,
        startColumn: range.startColumn + offsetX,
        endColumn: range.endColumn + offsetX,
    });

    static subtract(range1: IRange, range2: IRange): IRange[] {
        // 如果没有交集，则返回 range1
        if (
            range2.startRow >= range1.endRow ||
            range2.endRow <= range1.startRow ||
            range2.startColumn >= range1.endColumn ||
            range2.endColumn <= range1.startColumn
        ) {
            return [range1];
        }

        const ranges: IRange[] = [];

        // 上部分
        if (range2.startRow > range1.startRow) {
            ranges.push({
                startRow: range1.startRow,
                startColumn: range1.startColumn,
                endRow: range2.startRow,
                endColumn: range1.endColumn,
            });
        }

        // 下部分
        if (range2.endRow < range1.endRow) {
            ranges.push({
                startRow: range2.endRow,
                startColumn: range1.startColumn,
                endRow: range1.endRow,
                endColumn: range1.endColumn,
            });
        }

        // 左部分
        const topBoundary = Math.max(range1.startRow, range2.startRow);
        const bottomBoundary = Math.min(range1.endRow, range2.endRow);

        if (range2.startColumn > range1.startColumn) {
            ranges.push({
                startRow: topBoundary,
                startColumn: range1.startColumn,
                endRow: bottomBoundary,
                endColumn: range2.startColumn,
            });
        }

        // 右部分
        if (range2.endColumn < range1.endColumn) {
            ranges.push({
                startRow: topBoundary,
                startColumn: range2.endColumn,
                endRow: bottomBoundary,
                endColumn: range1.endColumn,
            });
        }

        return ranges;
    }
}
