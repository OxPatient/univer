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

import { Direction } from '@univerjs/core';

import {
    chineseToNumber,
    fillChnNumber,
    fillChnWeek,
    fillCopy,
    fillExtendNumber,
    fillLoopSeries,
    fillSeries,
    getLoopSeriesInfo,
    isChnNumber,
    isChnWeek2,
    isChnWeek3,
    isEqualDiff,
    isLoopSeries,
    matchExtendNumber,
} from './tools';
import type { IAutoFillRule } from './type';
import { APPLY_TYPE, DATA_TYPE } from './type';

export const numberRule: IAutoFillRule = {
    type: DATA_TYPE.NUMBER,
    priority: 1000,
    match: (cellData) => typeof cellData?.v === 'number' || !isNaN(Number(cellData?.v)),
    // TODO@yuhongz: not the good way to match number, will be changed after cell type is supported
    isContinue: (prev, cur) => {
        if (prev.type === DATA_TYPE.NUMBER) {
            return true;
        }
        return false;
    },
    applyFunctions: {
        [APPLY_TYPE.SERIES]: (dataWithIndex, len, direction) => {
            const { data } = dataWithIndex;
            if (direction === Direction.LEFT || direction === Direction.UP) {
                data.reverse();
            }
            return fillSeries(data, len, direction);
        },
    },
};

export const otherRule: IAutoFillRule = {
    type: DATA_TYPE.OTHER,
    priority: 0,
    match: () => true,
    isContinue: (prev, cur) => {
        if (prev.type === DATA_TYPE.OTHER) {
            return true;
        }
        return false;
    },
};

export const extendNumberRule: IAutoFillRule = {
    type: DATA_TYPE.EXTEND_NUMBER,
    priority: 900,
    match: (cellData) => matchExtendNumber(`${cellData?.v}` || '').isExtendNumber,
    isContinue: (prev, cur) => {
        if (prev.type === DATA_TYPE.EXTEND_NUMBER) {
            const { beforeTxt, afterTxt } = matchExtendNumber(`${prev.cellData?.v}` || '');
            const { beforeTxt: curBeforeTxt, afterTxt: curAfterTxt } = matchExtendNumber(`${cur?.v}` || '');
            if (beforeTxt === curBeforeTxt && afterTxt === curAfterTxt) {
                return true;
            }
        }
        return false;
    },
    applyFunctions: {
        [APPLY_TYPE.SERIES]: (dataWithIndex, len, direction) => {
            const { data } = dataWithIndex;

            let step;
            if (data.length === 1) {
                step = direction === Direction.DOWN || direction === Direction.RIGHT ? 1 : -1;
                return fillExtendNumber(data, len, step);
            }
            const dataNumArr = [];

            for (let i = 0; i < data.length; i++) {
                const txt = `${data[i]?.v}`;
                txt && dataNumArr.push(Number(matchExtendNumber(txt).matchTxt));
            }

            if (direction === Direction.UP || direction === Direction.LEFT) {
                data.reverse();
                dataNumArr.reverse();
            }

            if (isEqualDiff(dataNumArr)) {
                step = dataNumArr[1] - dataNumArr[0];
                return fillExtendNumber(data, len, step);
            }
            return fillCopy(data, len);
        },
    },
};

export const chnNumberRule: IAutoFillRule = {
    type: DATA_TYPE.CHN_NUMBER,
    priority: 830,
    match: (cellData) => {
        if (isChnNumber(`${cellData?.v}` || '')) {
            return true;
        }
        return false;
    },
    isContinue: (prev, cur) => {
        if (prev.type === DATA_TYPE.CHN_NUMBER) {
            return true;
        }
        return false;
    },
    applyFunctions: {
        [APPLY_TYPE.SERIES]: (dataWithIndex, len, direction) => {
            const { data } = dataWithIndex;

            const isReverse = direction === Direction.LEFT || direction === Direction.UP;
            if (data.length === 1) {
                const formattedValue = `${data[0]?.v}`;
                let step;
                if (!isReverse) {
                    step = 1;
                } else {
                    step = -1;
                }
                if (formattedValue && (formattedValue === '日' || chineseToNumber(formattedValue) < 7)) {
                    return fillChnWeek(data, len, step);
                }

                return fillChnNumber(data, len, step);
            }
            let hasWeek = false;
            for (let i = 0; i < data.length; i++) {
                const formattedValue = data[i]?.v;

                if (formattedValue === '日') {
                    hasWeek = true;
                    break;
                }
            }

            const dataNumArr = [];
            let weekIndex = 0;
            for (let i = 0; i < data.length; i++) {
                const formattedValue = `${data[i]?.v}`;
                if (formattedValue === '日') {
                    if (i === 0) {
                        dataNumArr.push(0);
                    } else {
                        weekIndex++;
                        dataNumArr.push(weekIndex * 7);
                    }
                } else if (hasWeek && chineseToNumber(formattedValue) > 0 && chineseToNumber(formattedValue) < 7) {
                    dataNumArr.push(chineseToNumber(formattedValue) + weekIndex * 7);
                } else {
                    dataNumArr.push(chineseToNumber(formattedValue));
                }
            }

            if (isReverse) {
                data.reverse();
                dataNumArr.reverse();
            }

            if (isEqualDiff(dataNumArr)) {
                if (
                    hasWeek ||
                    (dataNumArr[dataNumArr.length - 1] < 6 && dataNumArr[0] > 0) ||
                    (dataNumArr[0] < 6 && dataNumArr[dataNumArr.length - 1] > 0)
                ) {
                    // Fill with sequence of Monday~Sunday
                    const step = dataNumArr[1] - dataNumArr[0];
                    return fillChnWeek(data, len, step);
                }
                // Fill with sequence of Chinese lowercase numbers
                const step = dataNumArr[1] - dataNumArr[0];
                return fillChnNumber(data, len, step);
            }
            // Not an arithmetic progression, copy data
            return fillCopy(data, len);
        },
    },
};

export const chnWeek2Rule: IAutoFillRule = {
    type: DATA_TYPE.CHN_WEEK2,
    priority: 820,
    match: (cellData) => {
        if (isChnWeek2(`${cellData?.v}` || '')) {
            return true;
        }
        return false;
    },
    isContinue: (prev, cur) => prev.type === DATA_TYPE.CHN_WEEK2,
    applyFunctions: {
        [APPLY_TYPE.SERIES]: (dataWithIndex, len, direction) => {
            const { data } = dataWithIndex;

            const isReverse = direction === Direction.LEFT || direction === Direction.UP;
            if (data.length === 1) {
                let step;
                if (!isReverse) {
                    step = 1;
                } else {
                    step = -1;
                }

                return fillChnWeek(data, len, step, 1);
            }
            const dataNumArr = [];
            let weekIndex = 0;

            for (let i = 0; i < data.length; i++) {
                const formattedValue = `${data[i]?.v}`;
                const lastTxt = formattedValue?.substr(formattedValue.length - 1, 1);
                if (formattedValue === '周日') {
                    if (i === 0) {
                        dataNumArr.push(0);
                    } else {
                        weekIndex++;
                        dataNumArr.push(weekIndex * 7);
                    }
                } else {
                    dataNumArr.push(chineseToNumber(lastTxt) + weekIndex * 7);
                }
            }

            if (isReverse) {
                data.reverse();
                dataNumArr.reverse();
            }

            if (isEqualDiff(dataNumArr)) {
                const step = dataNumArr[1] - dataNumArr[0];
                return fillChnWeek(data, len, step, 1);
            }
            return fillCopy(data, len);
        },
    },
};

export const chnWeek3Rule: IAutoFillRule = {
    type: DATA_TYPE.CHN_WEEK3,
    priority: 810,
    match: (cellData) => isChnWeek3(`${cellData?.v}` || ''),
    isContinue: (prev, cur) => prev.type === DATA_TYPE.CHN_WEEK3,
    applyFunctions: {
        [APPLY_TYPE.SERIES]: (dataWithIndex, len, direction) => {
            const { data } = dataWithIndex;

            const isReverse = direction === Direction.LEFT || direction === Direction.UP;
            if (data.length === 1) {
                let step;
                if (!isReverse) {
                    step = 1;
                } else {
                    step = -1;
                }

                return fillChnWeek(data, len, step, 2);
            }
            const dataNumArr = [];
            let weekIndex = 0;

            for (let i = 0; i < data.length; i++) {
                const formattedValue = `${data[i]?.v}`;
                if (formattedValue) {
                    const lastTxt = formattedValue.substr(formattedValue.length - 1, 1);
                    if (formattedValue === '星期日') {
                        if (i === 0) {
                            dataNumArr.push(0);
                        } else {
                            weekIndex++;
                            dataNumArr.push(weekIndex * 7);
                        }
                    } else {
                        dataNumArr.push(chineseToNumber(lastTxt) + weekIndex * 7);
                    }
                }
            }

            if (isReverse) {
                data.reverse();
                dataNumArr.reverse();
            }

            if (isEqualDiff(dataNumArr)) {
                const step = dataNumArr[1] - dataNumArr[0];
                return fillChnWeek(data, len, step, 2);
            }
            return fillCopy(data, len);
        },
    },
};

export const loopSeriesRule: IAutoFillRule = {
    type: DATA_TYPE.LOOP_SERIES,
    priority: 800,
    match: (cellData) => isLoopSeries(`${cellData?.v}` || ''),
    isContinue: (prev, cur) => {
        if (prev.type === DATA_TYPE.LOOP_SERIES) {
            return getLoopSeriesInfo(`${prev.cellData?.v}` || '').name === getLoopSeriesInfo(`${cur?.v}` || '').name;
        }
        return false;
    },
    applyFunctions: {
        [APPLY_TYPE.SERIES]: (dataWithIndex, len, direction) => {
            const { data } = dataWithIndex;
            const isReverse = direction === Direction.LEFT || direction === Direction.UP;
            const { series } = getLoopSeriesInfo(`${data[0]?.v}` || '');
            if (data.length === 1) {
                let step;
                if (!isReverse) {
                    step = 1;
                } else {
                    step = -1;
                }

                return fillLoopSeries(data, len, step, series);
            }
            const dataNumArr = [];
            let cycleIndex = 0;
            for (let i = 0; i < data.length; i++) {
                const formattedValue = `${data[i]?.v}`;
                if (formattedValue) {
                    if (formattedValue === series[0]) {
                        if (i === 0) {
                            dataNumArr.push(0);
                        } else {
                            cycleIndex++;
                            dataNumArr.push(cycleIndex * series.length);
                        }
                    } else {
                        dataNumArr.push(series.indexOf(formattedValue) + cycleIndex * 7);
                    }
                }
            }

            if (isReverse) {
                data.reverse();
                dataNumArr.reverse();
            }

            if (isEqualDiff(dataNumArr)) {
                const step = dataNumArr[1] - dataNumArr[0];
                return fillLoopSeries(data, len, step, series);
            }
            return fillCopy(data, len);
        },
    },
};
