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
import { EditorState } from '@tiptap/pm/state';
import { Editor } from '@tiptap/react';
import { isEmpty } from 'lodash';
import Showdown from 'showdown';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { ENTITY_URL_MAP } from '../constants/Feeds.constants';
import { getEntityDetail, getHashTagList, getMentionList } from './FeedUtils';

export const getSelectedText = (state: EditorState) => {
  const { from, to } = state.selection;

  const text = state.doc.textBetween(from, to);

  return text;
};

export const isInViewport = (ele: HTMLElement, container: HTMLElement) => {
  const eleTop = ele.offsetTop;
  const eleBottom = eleTop + ele.clientHeight;

  const containerTop = container.scrollTop;
  const containerBottom = containerTop + container.clientHeight;

  // The element is fully visible in the container
  return eleTop >= containerTop && eleBottom <= containerBottom;
};

const _convertMarkdownFormatToHtmlString = (markdown: string) => {
  let updatedMessage = markdown;
  const urlEntries = Object.entries(ENTITY_URL_MAP);

  const mentionList = getMentionList(markdown) ?? [];
  const hashTagList = getHashTagList(markdown) ?? [];

  const mentionMap = new Map<string, RegExpMatchArray | null>(
    mentionList.map((mention) => [mention, getEntityDetail(mention)])
  );

  const hashTagMap = new Map<string, RegExpMatchArray | null>(
    hashTagList.map((hashTag) => [hashTag, getEntityDetail(hashTag)])
  );

  mentionMap.forEach((value, key) => {
    if (value) {
      const [, href, rawEntityType, fqn] = value;
      const entityType = urlEntries.find((e) => e[1] === rawEntityType)?.[0];

      if (entityType) {
        const entityLink = `<a href="${href}/${rawEntityType}/${fqn}" data-type="mention" data-entityType="${entityType}" data-fqn="${fqn}" data-label="${fqn}">@${fqn}</a>`;
        updatedMessage = updatedMessage.replaceAll(key, entityLink);
      }
    }
  });

  hashTagMap.forEach((value, key) => {
    if (value) {
      const [, href, rawEntityType, fqn] = value;

      const entityLink = `<a href="${href}/${rawEntityType}/${fqn}" data-type="hashtag" data-entityType="${rawEntityType}" data-fqn="${fqn}" data-label="${fqn}">#${fqn}</a>`;
      updatedMessage = updatedMessage.replaceAll(key, entityLink);
    }
  });

  return updatedMessage;
};

export type FormatContentFor = 'server' | 'client';

export const formatContent = (
  htmlString: string,
  formatFor: FormatContentFor
) => {
  // Create a new DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    _convertMarkdownFormatToHtmlString(htmlString),
    'text/html'
  );

  // Use querySelectorAll to find all anchor tags with text content starting with "@" or "#"
  const anchorTags = doc.querySelectorAll(
    'a[data-type="mention"], a[data-type="hashtag"]'
  );

  if (formatFor === 'server') {
    anchorTags.forEach((tag) => {
      const href = tag.getAttribute('href');
      const text = tag.textContent;
      const fqn = tag.getAttribute('data-fqn');
      const entityType = tag.getAttribute('data-entityType');

      const entityLink = `<#E${FQN_SEPARATOR_CHAR}${entityType}${FQN_SEPARATOR_CHAR}${fqn}|[${text}](${href})>`;
      tag.textContent = entityLink;
    });
  } else {
    anchorTags.forEach((tag) => {
      const label = tag.getAttribute('data-label');
      const type = tag.getAttribute('data-type');
      const prefix = type === 'mention' ? '@' : '#';

      tag.textContent = `${prefix}${label}`;
    });
  }
  const modifiedHtmlString = doc.body.innerHTML;

  return modifiedHtmlString;
};

export const isHTMLString = (content: string) => {
  try {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(content, 'text/html');

    // since text can be also counted as child node so we will check if length is greater than 1
    return parsedDocument.body.childNodes.length > 1;
  } catch (e) {
    return false;
  }
};

/**
 * Convert a markdown string to an HTML string
 */
const _convertMarkdownStringToHtmlString = new Showdown.Converter({
  ghCodeBlocks: false,
  encodeEmails: false,
  ellipsis: false,
});

export const getHtmlStringFromMarkdownString = (content: string) => {
  return isHTMLString(content)
    ? content
    : _convertMarkdownStringToHtmlString.makeHtml(content);
};

/**
 * Set the content of the editor
 * @param editor The editor instance
 * @param newContent The new content to set
 */
export const setEditorContent = (editor: Editor, newContent: string) => {
  // Convert the markdown string to an HTML string
  const htmlString = getHtmlStringFromMarkdownString(newContent);

  editor.commands.setContent(htmlString);

  // Update the editor state to reflect the new content
  const newEditorState = EditorState.create({
    doc: editor.state.doc,
    plugins: editor.state.plugins,
    schema: editor.state.schema,
    selection: editor.state.selection,
    storedMarks: editor.state.storedMarks,
  });
  editor.view.updateState(newEditorState);
};

/**
 *
 * @param content The content to check
 * @returns Whether the content is empty or not
 */
export const isDescriptionContentEmpty = (content: string) => {
  // Check if the content is empty or has only empty paragraph tags
  return isEmpty(content) || content === '<p></p>';
};

/**
 *
 * @param description HTML string
 * @returns Text from HTML string
 */
export const getTextFromHtmlString = (description?: string): string => {
  if (!description) {
    return '';
  }

  return description.replace(/<[^>]{1,1000}>/g, '').trim();
};
