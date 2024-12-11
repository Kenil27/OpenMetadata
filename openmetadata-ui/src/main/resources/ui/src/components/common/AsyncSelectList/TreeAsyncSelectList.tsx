/*
 *  Copyright 2023 Collate.
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
import { CloseOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import {
  Button,
  Empty,
  Form,
  Space,
  TagProps,
  TreeSelect,
  TreeSelectProps,
} from 'antd';
import { Key } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import { debounce, get, isEmpty, isNull, isUndefined, pick } from 'lodash';
import { CustomTagProps } from 'rc-select/lib/BaseSelect';
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowIcon } from '../../../assets/svg/ic-arrow-down.svg';
import { PAGE_SIZE_LARGE, TEXT_BODY_COLOR } from '../../../constants/constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { Glossary } from '../../../generated/entity/data/glossary';
import { LabelType } from '../../../generated/entity/data/table';
import { TagLabel } from '../../../generated/type/tagLabel';
import {
  getGlossariesList,
  ListGlossaryTermsParams,
  queryGlossaryTerms,
  searchGlossaryTerms,
} from '../../../rest/glossaryAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  convertGlossaryTermsToTreeOptions,
  filterTreeNodeOptions,
  findGlossaryTermByFqn,
} from '../../../utils/GlossaryUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../utils/StringsUtils';
import { getTagDisplay, tagRender } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ModifiedGlossaryTerm } from '../../Glossary/GlossaryTermTab/GlossaryTermTab.interface';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import Loader from '../Loader/Loader';
import './async-select-list.less';
import {
  AsyncSelectListProps,
  SelectOption,
} from './AsyncSelectList.interface';

const TreeAsyncSelectList: FC<Omit<AsyncSelectListProps, 'fetchOptions'>> = ({
  onChange,
  initialOptions,
  tagType,
  isSubmitLoading,
  filterOptions = [],
  onCancel,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const selectedTagsRef = useRef<SelectOption[]>(initialOptions ?? []);
  const { t } = useTranslation();
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const expandableKeys = useRef<string[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Key[]>([]);
  const [searchOptions, setSearchOptions] = useState<Glossary[] | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(true);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const form = Form.useFormInstance();

  const fetchGlossaryListInternal = async () => {
    setIsLoading(true);
    try {
      const { data } = await getGlossariesList({
        limit: PAGE_SIZE_LARGE,
      });
      setGlossaries((prev) =>
        filterTreeNodeOptions([...prev, ...data], filterOptions)
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlossaryListInternal();
  }, []);

  const dropdownRender = (menu: React.ReactElement) => (
    <>
      {isLoading ? <Loader size="small" /> : menu}
      <Space className="p-sm p-b-xss p-l-xs custom-dropdown-render" size={8}>
        <Button
          className="update-btn"
          data-testid="saveAssociatedTag"
          disabled={isEmpty(glossaries)}
          htmlType="submit"
          loading={isSubmitLoading}
          size="small"
          type="default"
          onClick={(event) => {
            event.stopPropagation();
            form.submit();
          }}
          onMouseDown={(e) => e.preventDefault()}>
          {t('label.update')}
        </Button>
        <Button
          data-testid="cancelAssociatedTag"
          size="small"
          type="link"
          onClick={onCancel}
          onMouseDown={(e) => e.preventDefault()}>
          {t('label.cancel')}
        </Button>
      </Space>
    </>
  );

  const customTagRender = (data: CustomTagProps) => {
    const selectedTag = selectedTagsRef.current.find(
      (tag) => tag.value === data.value
    );

    if (isUndefined(selectedTag?.data)) {
      return tagRender(data);
    }

    const { value, onClose } = data;
    const tagLabel = getTagDisplay(value as string);
    const tag = {
      tagFQN: selectedTag?.data.fullyQualifiedName,
      ...pick(
        selectedTag?.data,
        'description',
        'displayName',
        'name',
        'style',
        'tagFQN'
      ),
    } as TagLabel;

    const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const isDerived =
      (selectedTag?.data as TagLabel).labelType === LabelType.Derived;

    const tagProps = {
      closable: !isDerived,
      closeIcon: !isDerived && (
        <CloseOutlined
          className="p-r-xs"
          data-testid="remove-tags"
          height={8}
          width={8}
        />
      ),
      'data-testid': `selected-tag-${tagLabel}`,
      onClose: !isDerived ? onClose : null,
      onMouseDown: onPreventMouseDown,
    } as TagProps;

    return (
      <TagsV1
        startWith={TAG_START_WITH.SOURCE_ICON}
        tag={tag}
        tagProps={tagProps}
        tagType={tagType}
        tooltipOverride={
          isDerived ? t('message.derived-tag-warning') : undefined
        }
      />
    );
  };

  const handleChange: TreeSelectProps['onChange'] = (
    values: {
      disabled: boolean;
      halfChecked: boolean;
      label: React.ReactNode;
      value: string;
    }[]
  ) => {
    const lastSelectedMap = new Map(
      selectedTagsRef.current.map((tag) => [tag.value, tag])
    );
    const selectedValues = values.map(({ value }) => {
      if (lastSelectedMap.has(value)) {
        return lastSelectedMap.get(value) as SelectOption;
      }
      const initialData = findGlossaryTermByFqn(
        [
          ...glossaries,
          ...(isNull(searchOptions) ? [] : searchOptions),
          ...(initialOptions ?? []),
        ] as ModifiedGlossaryTerm[],
        value,
        false
      );

      return initialData
        ? {
            value: initialData.fullyQualifiedName ?? '',
            label: getEntityName(initialData),
            data: initialData,
          }
        : {
            value,
            label: value,
          };
    });
    selectedTagsRef.current = selectedValues as SelectOption[];
    onChange?.(selectedValues);
  };

  const fetchGlossaryTerm = async (params?: ListGlossaryTermsParams) => {
    if (!params?.glossary) {
      return;
    }
    try {
      const results = await queryGlossaryTerms(params.glossary);

      const activeGlossary = results[0];

      setGlossaries((prev) =>
        filterTreeNodeOptions(
          prev.map((glossary) => ({
            ...glossary,
            children: get(
              glossary.id === activeGlossary?.id ? activeGlossary : glossary,
              'children',
              []
            ),
          })),
          filterOptions
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onSearch = debounce(async (value: string) => {
    if (value) {
      setIsLoading(true);
      const encodedValue = getEncodedFqn(escapeESReservedCharacters(value));
      const results: Glossary[] = await searchGlossaryTerms(encodedValue);

      setSearchOptions(filterTreeNodeOptions(results, filterOptions));
      setExpandedRowKeys(
        results.map((result) => result.fullyQualifiedName as string)
      );
      setIsLoading(false);
    } else {
      setSearchOptions(null);
    }
  }, 300);

  // Function to handle dropdown visibility change
  const handleDropdownVisibleChange = (open: boolean) => {
    if (open) {
      setIsDropdownOpen(open);
    }
  };

  // Function to prevent dropdown from closing when selecting an option
  const handleBlur = () => {
    const dropdownElement = dropdownRef.current;
    if (!dropdownElement) {
      return;
    }

    setTimeout(() => {
      // Focus check for specific elements that should keep the dropdown open
      const focusableElements = [
        '.update-btn',
        '.cancelAssociatedTag',
        '.input',
      ];

      // Check if focus is on any of the elements in the list
      const isFocusInsideRelevantElement = focusableElements.some((selector) =>
        dropdownElement
          .querySelector(selector)
          ?.contains(document.activeElement)
      );

      // If focus is not inside any relevant element, close the dropdown
      if (!isFocusInsideRelevantElement) {
        setIsDropdownOpen(false);
        onCancel?.();
      }
    }, 0);
  };

  // Function to handle clicks outside the dropdown
  const handleClickOutside = (event: MouseEvent) => {
    const dropdownElement = dropdownRef.current;

    if (!dropdownElement) {
      return;
    }
    const focusableElements = ['.input', '.ant-select-item', '.update-btn'];
    const isClickInsideRelevantElement = focusableElements.some((selector) =>
      (event.target as HTMLElement).closest(selector)
    );

    const isClickInsideDropdown = dropdownElement.contains(
      event.target as Node
    );

    // Close dropdown only if the click is outside both dropdown and relevant elements
    if (!isClickInsideDropdown && !isClickInsideRelevantElement) {
      setIsDropdownOpen(false);
      onCancel?.();
    }
  };

  // Attach event listener for outside clicks
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => handleClickOutside(event);

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [onCancel]);

  useEffect(() => {
    if (glossaries.length) {
      expandableKeys.current = glossaries.map((glossary) => glossary.id);
    }
  }, [glossaries]);

  const treeData = useMemo(
    () =>
      convertGlossaryTermsToTreeOptions(
        isNull(searchOptions)
          ? (glossaries as ModifiedGlossaryTerm[])
          : (searchOptions as unknown as ModifiedGlossaryTerm[])
      ),
    [glossaries, searchOptions, expandableKeys.current]
  );

  return (
    <div ref={dropdownRef}>
      <TreeSelect
        autoFocus
        showSearch
        treeCheckStrictly
        treeCheckable
        className="async-select-list"
        data-testid="tag-selector"
        dropdownRender={dropdownRender}
        dropdownStyle={{ width: 300 }}
        filterTreeNode={false}
        loadData={({ id, name }) => {
          if (expandableKeys.current.includes(id)) {
            return fetchGlossaryTerm({ glossary: name as string });
          }

          return Promise.resolve();
        }}
        notFoundContent={
          isLoading ? (
            <Loader size="small" />
          ) : (
            <Empty
              description={t('label.no-entity-available', {
                entity: t('label.glossary-term'),
              })}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )
        }
        open={isDropdownOpen}
        showCheckedStrategy={TreeSelect.SHOW_ALL}
        style={{ width: '100%' }}
        switcherIcon={
          <Icon
            component={ArrowIcon}
            data-testid="expand-icon"
            style={{ fontSize: '10px', color: TEXT_BODY_COLOR }}
          />
        }
        tagRender={customTagRender}
        treeData={treeData}
        treeExpandedKeys={isEmpty(searchOptions) ? undefined : expandedRowKeys}
        onBlur={handleBlur}
        onChange={handleChange}
        onDropdownVisibleChange={handleDropdownVisibleChange}
        onSearch={onSearch}
        onTreeExpand={setExpandedRowKeys}
        {...props}
      />
    </div>
  );
};

export default TreeAsyncSelectList;
