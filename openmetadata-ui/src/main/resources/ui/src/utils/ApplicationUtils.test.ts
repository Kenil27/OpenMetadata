/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { upperFirst } from 'lodash';
import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import { Status } from '../generated/entity/applications/appRunRecord';
import {
  getEntityStatsData,
  getStatusTypeForApplication,
} from './ApplicationUtils';
import {
  MOCK_APPLICATION_ENTITY_STATS,
  MOCK_APPLICATION_ENTITY_STATS_DATA,
} from './mocks/ApplicationUtils.mock';

describe('ApplicationUtils tests', () => {
  it('getEntityStatsData should return stats data in array', () => {
    const resultData = getEntityStatsData(MOCK_APPLICATION_ENTITY_STATS);

    expect(resultData).toEqual(
      MOCK_APPLICATION_ENTITY_STATS_DATA.map((data) => ({
        ...data,
        name: upperFirst(data.name),
      }))
    );
  });
});

describe('getStatusTypeForApplication tests', () => {
  it('should return PartialSuccess for PartialSuccess status', () => {
    expect(getStatusTypeForApplication(Status.PartialSuccess)).toBe(
      StatusType.PartialSuccess
    );
  });
});
