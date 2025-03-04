﻿import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import { LoadDiv, Icon } from 'ming-ui';
import { every, isEmpty } from 'lodash';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { DndProvider, useDrop } from 'react-dnd-latest';
import { HTML5Backend } from 'react-dnd-html5-backend-latest';
import { getIconByType } from 'src/pages/widgetConfig/util';
import { updateWorksheetRow } from 'src/api/worksheet';
import * as boardActions from 'src/pages/worksheet/redux/actions/boardView';
import * as baseAction from 'src/pages/worksheet/redux/actions';
import { getAdvanceSetting } from 'src/util';
import { filterAndFormatterControls } from '../util';
import SelectField from '../components/SelectField';
import ViewEmpty from '../components/ViewEmpty';
import Board from './RecordList';
import { ITEM_TYPE } from './config';
import { dealBoardViewData } from './util';
import './index.less';

export const RecordBoardWrap = styled.div`
  height: 100%;
  padding-right: 14px;
  .boardListWrap {
    overflow-x: auto;
    display: flex;
    flex-wrap: nowrap;
    padding: 0 14px;
    height: 100%;
  }
`;

function BoardView(props) {
  const {
    worksheetId,
    controls,
    getBoardViewPageData,
    isCharge,
    viewId,
    view,
    boardView,
    toCustomWidget,
    saveView,
    sortBoardRecord,
    initBoardViewData,
    setViewConfigVisible,
    filters,
    addRecord,
    updateMultiSelectBoard,
    ...rest
  } = props;

  const [collect, drop] = useDrop({
    accept: ITEM_TYPE.RECORD,
    hover(props, monitor) {
      function scroll() {
        const $wrap = document.querySelector('.boardListWrap');
        const pos = $wrap.getBoundingClientRect();
        const offset = monitor.getClientOffset();
        if (offset.x < pos.x + 40) {
          $wrap.scrollLeft -= 20;
        }
        if (offset.x + 40 > pos.x + pos.width) {
          $wrap.scrollLeft += 20;
        }
      }
      _.throttle(scroll)();
    },
  });

  const $listWrapRef = useRef(null);
  const flagRef = useRef({ preScrollLeft: 0, pending: false });

  const setFlagRef = obj => {
    const { current: flag } = flagRef;
    flagRef.current = { ...flag, ...obj };
  };

  const scrollLoad = () => {
    const $listWrap = _.get($listWrapRef, 'current');
    const { current: flag } = flagRef;
    const { preScrollLeft, pending } = flag;
    const { scrollLeft, scrollWidth, offsetWidth } = $listWrap;
    if (pending) return;
    setFlagRef({ preScrollLeft: scrollLeft });
    // 距离右侧边界还有两个看板的距离 且是在向右滚动  加载下一页看板
    if (scrollLeft + offsetWidth > scrollWidth - 560 && scrollLeft > preScrollLeft) {
      setFlagRef({ pending: true });
      getBoardViewPageData({
        alwaysCallback: () => {
          setFlagRef({ pending: false });
        },
      });
    }
  };

  const scrollHorizontal = e => {
    const $tar = e.target;
    const $listWrap = _.get($listWrapRef, 'current');
    if (!$listWrap) return;
    if (
      (_.includes($tar.className, 'boardViewRecordListWrap') || _.includes($tar.className, 'boardTitleWrap')) &&
      !!e.deltaY
    ) {
      $listWrap.scrollLeft = e.deltaY * 10 + $listWrap.scrollLeft;
    }
  };
  const bindEvent = () => {
    const scrollEvent = _.throttle(scrollHorizontal);
    const scrollLoadEvent = _.throttle(scrollLoad);
    const $listWrap = _.get($listWrapRef, 'current');
    document.body.addEventListener('mousewheel', scrollEvent);
    window.addEventListener('resize', scrollEvent);
    if ($listWrap) {
      $listWrap.addEventListener('scroll', scrollLoadEvent);
    }
    return () => {
      document.body.removeEventListener('mousewheel', scrollEvent);
      window.removeEventListener('resize', scrollEvent);
      if ($listWrap) {
        $listWrap.removeEventListener('scroll', scrollLoadEvent);
      }
    };
  };

  useEffect(() => {
    const unBindEvent = bindEvent();
    return () => unBindEvent();
  }, []);

  useEffect(() => {
    initBoardViewData();
  }, [viewId, view.viewControl]);

  const handleSelectField = obj => {
    if (!isCharge) return;
    const nextView = { ...view, ...obj };
    setViewConfigVisible(true);
    saveView(viewId, nextView, () => {
      initBoardViewData(nextView);
    });
  };

  const selectControl = () => {
    const { viewControl } = view;
    return _.find(controls, item => item.controlId === viewControl);
  };

  // 记录排序
  const sortRecord = obj => {
    const { rowId, value, rawRow } = obj;
    const { viewControl } = view;
    const para = {
      rowId,
      ..._.pick(props, ['appId', 'worksheetId', 'viewId', 'projectId']),
      newOldControl: [{ ..._.pick(selectControl(), ['controlId', 'type', 'controlName', 'dot']), value }],
    };
    if (Reflect.has(obj, 'rawRow')) {
      const originData = JSON.parse(rawRow) || {};
      updateWorksheetRow(para).then(res => {
        if (!isEmpty(res.data)) {
          // 后端更新后返回的权限不准 使用获取时候的权限
          const originAuth = _.pick(originData, ['allowedit', 'allowdelete']);
          updateMultiSelectBoard({
            rowId,
            item: { ...res.data, ...originAuth },
            prevValue: originData[viewControl],
            currentValue: value,
          });
        } else {
          alert(_l('拖拽更新失败!'));
        }
      });
      return;
    }
    sortBoardRecord({
      ...obj,
      ...para,
    });
  };

  const renderContent = () => {
    const { boardViewLoading, boardData } = boardView;
    const { viewControl } = view;
    const viewData = dealBoardViewData({ view, controls, data: boardData });
    const { hidenone } = getAdvanceSetting(view);
    // 选择了控件作为看板且控件没有被删除
    const isHaveSelectControl = viewControl && _.find(controls, item => item.controlId === viewControl);
    if (!isHaveSelectControl) {
      return (
        <SelectField
          isCharge={isCharge}
          fields={filterAndFormatterControls({
            controls: controls,
            formatter: ({ controlName, controlId, type }) => ({
              text: controlName,
              value: controlId,
              icon: getIconByType(type),
            }),
          })}
          handleSelect={handleSelectField}
          toCustomWidget={toCustomWidget}
        />
      );
    }

    const renderBoard = () => {
      return every(viewData, item => isEmpty(item.rows)) ? (
        <ViewEmpty filters={filters} viewFilter={view.filters || []} />
      ) : (
        (viewData || []).map((board, index) => {
          if (!(_.get(board, 'rows') || []).length) {
            // 看板无数据时 当配置隐藏无数据看板或看板本身是未分类时 看板不显示
            if (board.noGroup || hidenone === '1') return null;
          }
          return (
            <Board
              {...boardView}
              key={index}
              index={index}
              list={board}
              viewData={viewData}
              view={view}
              worksheetId={worksheetId}
              viewControl={viewControl}
              sortRecord={sortRecord}
              selectControl={selectControl()}
              addRecord={addRecord}
              {..._.pick(props, [
                'appId',
                'viewId',
                'searchRow',
                'updateBoardViewData',
                'isCharge',
                'sheetSwitchPermit',
              ])}
              {...rest}
            />
          );
        })
      );
    };

    return (
      <div className="boardListWrap" ref={$listWrapRef}>
        {boardViewLoading ? <LoadDiv /> : renderBoard()}
      </div>
    );
  };

  return (
    <div className="worksheetBoardViewWrap" ref={drop}>
      <RecordBoardWrap>{renderContent()}</RecordBoardWrap>
    </div>
  );
}

const ConnectedBoardView = connect(
  state =>
    _.pick(state.sheet, ['boardView', 'worksheetInfo', 'filters', 'controls', 'sheetSwitchPermit', 'sheetButtons']),
  dispatch => bindActionCreators({ ...boardActions, ...baseAction }, dispatch),
)(BoardView);

export default function Wrap(props) {
  return (
    <DndProvider key="board" context={window} backend={HTML5Backend}>
      <ConnectedBoardView {...props} />
    </DndProvider>
  );
}
