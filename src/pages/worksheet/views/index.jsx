import React from 'react';
import PropTypes from 'prop-types';
import errorBoundary from 'ming-ui/decorators/errorBoundary';
import SheetView from 'worksheet/views/SheetView';
import BoardView from './BoardView';
import HierarchyView from './HierarchyView';
import GalleryView from 'worksheet/views/GalleryView';
import CalendarView from 'worksheet/views/CalendarView';
import GunterView from 'worksheet/views/GunterView/enter';
import Skeleton from 'src/router/Application/Skeleton';
import UnNormal from 'worksheet/views/components/UnNormal';
import { VIEW_DISPLAY_TYPE } from 'worksheet/constants/enum';
import styled from 'styled-components';

const { board, sheet, calendar, gallery, structure, gunter } = VIEW_DISPLAY_TYPE;

const Con = styled.div`
  height: 100%;
  flex: 1;
  overflow: hidden;
  position: relative;
`;

const Loading = styled.div``;

const TYPE_TO_COMP = {
  [board]: BoardView,
  [sheet]: SheetView,
  [gallery]: GalleryView,
  [calendar]: CalendarView,
  [structure]: HierarchyView,
  [gunter]: GunterView,
};
function View(props) {
  const { loading, view, showAsSheetView } = props;
  let activeViewStatus = props.activeViewStatus;
  if (loading) {
    return (
      <Con>
        <Loading>
          <Skeleton
            style={{ flex: 1 }}
            direction="column"
            widths={['30%', '40%', '90%', '60%']}
            active
            itemStyle={{ marginBottom: '10px' }}
          />
          <Skeleton
            style={{ flex: 1 }}
            direction="column"
            widths={['40%', '55%', '100%', '80%']}
            active
            itemStyle={{ marginBottom: '10px' }}
          />
          <Skeleton
            style={{ flex: 2 }}
            direction="column"
            widths={['45%', '100%', '100%', '100%']}
            active
            itemStyle={{ marginBottom: '10px' }}
          />
        </Loading>
      </Con>
    );
  }

  const viewProps = _.pick(props, [
    'isCharge',
    'appId',
    'groupId',
    'worksheetId',
    'view',
    'viewId',
    'chartId',
    'maxCount',
    'showControlIds',
    'openNewRecord',
    'setViewConfigVisible',
    'groupFilterWidth',
  ]);

  if (_.isEmpty(view) && !props.chartId) {
    // 图表引用视图允许不存在 viewId
    activeViewStatus = -10000;
  }

  const Component = TYPE_TO_COMP[String(showAsSheetView ? sheet : view.viewType)];

  return (
    <Con>
      {!Component || activeViewStatus !== 1 ? <UnNormal resultCode={activeViewStatus} /> : <Component {...viewProps} />}
    </Con>
  );
}

View.propTypes = {
  loading: PropTypes.bool,
  view: PropTypes.shape({}),
  activeViewStatus: PropTypes.number,
};

export default errorBoundary(View);
