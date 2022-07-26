import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { autobind } from 'core-decorators';
import { v4 as uuidv4 } from 'uuid';
import autoSize from 'ming-ui/decorators/autoSize';
import { emitter, sortControlByIds, getLRUWorksheetConfig } from 'worksheet/util';
import { getRowDetail } from 'worksheet/api';
import { editRecord } from 'worksheet/common/editRecord';
import { ROW_HEIGHT } from 'worksheet/constants/enum';
import Skeleton from 'src/router/Application/Skeleton';
import WorksheetTable from 'worksheet/components/WorksheetTable';
import DataFormat from 'src/components/newCustomFields/tools/DataFormat';
import { ColumnHead, SummaryCell, RowHead } from 'worksheet/components/WorksheetTable/components/';
import RecordInfo from 'worksheet/common/recordInfo/RecordInfoWrapper';
import { controlState } from 'src/components/newCustomFields/tools/utils';
import { updateWorksheetSomeControls, refreshWorksheetControls } from 'worksheet/redux/actions';
import * as sheetviewActions from 'worksheet/redux/actions/sheetview';
import { getAdvanceSetting } from 'src/util';
import { isOpenPermit } from 'src/pages/FormSet/util.js';
import { permitList } from 'src/pages/FormSet/config.js';
import _ from 'lodash';

@autoSize
class TableView extends React.Component {
  static propTypes = {
    worksheetInfo: PropTypes.shape({}),
    controls: PropTypes.arrayOf(PropTypes.shape({})),
    sheetFetchParams: PropTypes.shape({}),
    sheetViewData: PropTypes.shape({}),
    sheetViewConfig: PropTypes.shape({}),
    updateDefaultScrollLeft: PropTypes.func,
    updateRows: PropTypes.func,
    hideRows: PropTypes.func,
    clearHighLight: PropTypes.func,
    fetchRows: PropTypes.func,
    setHighLight: PropTypes.func,
    changeWorksheetSheetViewSummaryType: PropTypes.func,
    updateViewPermission: PropTypes.func,
    getWorksheetSheetViewSummary: PropTypes.func,
    updateSheetColumnWidths: PropTypes.func,
    updateWorksheetSomeControls: PropTypes.func,
  };

  table = React.createRef();

  constructor(props) {
    super(props);
    this.state = {};
    this.tableId = uuidv4();
    this.shiftActiveRowIndex = 0;
  }

  componentDidMount() {
    const { view, fetchRows, setRowsEmpty } = this.props;
    if (_.get(view, 'advancedSetting.clicksearch') !== '1' || this.readonly) {
      fetchRows({ isFirst: true });
    } else {
      setRowsEmpty();
    }
    document.body.addEventListener('click', this.outerClickEvent);
    emitter.addListener('RELOAD_RECORD_INFO', this.updateRecordEvent);
    this.handleSetAutoRefresh();
    this.bindShift();
  }

  componentWillReceiveProps(nextProps) {
    const { view, fetchRows, setRowsEmpty, changePageIndex } = nextProps;
    const changeView = this.props.worksheetId === nextProps.worksheetId && this.props.viewId !== nextProps.viewId;
    if (!_.isEqual(_.get(nextProps, ['navGroupFilters']), _.get(this.props, ['navGroupFilters']))) {
      changePageIndex(1);
    }
    if (
      _.some(
        ['sheetFetchParams', 'view.moreSort', 'view.advancedSetting.clicksearch', 'navGroupFilters'],
        key => !_.isEqual(_.get(nextProps, key), _.get(this.props, key)),
      ) ||
      changeView
    ) {
      if (
        _.get(view, 'advancedSetting.clicksearch') !== '1' ||
        _.get(this.props, 'sheetFetchParams.pageIndex') !== _.get(nextProps, 'sheetFetchParams.pageIndex')
      ) {
        fetchRows({ changeView });
      } else {
        setRowsEmpty();
      }
    }
    if (
      _.get(this.props, 'view.advancedSetting.refreshtime') !== _.get(nextProps, 'view.advancedSetting.refreshtime')
    ) {
      this.handleSetAutoRefresh(nextProps);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return (
      _.some(['recordInfoVisible'], key => !_.isEqual(_.get(nextState, key), _.get(this.state, key))) ||
      _.some(
        [
          'sheetViewData',
          'sheetViewConfig',
          'editingControls',
          'controls',
          'view.rowHeight',
          'view.showControls',
          'view.controls',
          'view.moreSort',
          'view.advancedSetting',
          'buttons',
        ],
        key => !_.isEqual(_.get(nextProps, key), _.get(this.props, key)),
      )
    );
  }

  componentWillUnmount() {
    document.body.removeEventListener('click', this.outerClickEvent);
    emitter.removeListener('RELOAD_RECORD_INFO', this.updateRecordEvent);
    this.unbindShift();
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  bindShift() {
    window.addEventListener('keydown', this.activeShift);
    window.addEventListener('keyup', this.deActiveShift);
  }

  unbindShift() {
    window.removeEventListener('keydown', this.activeShift);
    window.removeEventListener('keyup', this.deActiveShift);
  }

  @autobind
  activeShift(e) {
    if (e.keyCode === 16) {
      this.shiftActive = true;
    }
  }

  @autobind
  deActiveShift(e) {
    if (e.keyCode === 16) {
      this.shiftActive = false;
      console.log({ shiftActive: this.shiftActive });
    }
  }

  handleSetAutoRefresh(props) {
    const { view, refresh } = props || this.props;
    const refreshtime = _.get(view, 'advancedSetting.refreshtime');
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    if (refreshtime && _.includes(['10', '30', '60', '120', '180', '240', '300'], refreshtime)) {
      this.refreshTimer = setInterval(() => {
        refresh({ noLoading: true });
      }, Number(refreshtime) * 1000);
    }
  }

  @autobind
  outerClickEvent(e) {
    const { clearHighLight } = this.props;
    if (!$(e.target).closest('.mdTable, .recordInfoCon')[0] || /-grid/.test(e.target.className)) {
      clearHighLight(this.tableId);
      $(`.mdTable.id-${this.tableId}-id .cell`).removeClass('hover');
    }
  }

  @autobind
  updateRecordEvent({ worksheetId, recordId }) {
    const { viewId, controls, updateRows, hideRows, sheetViewData } = this.props;
    const { rows } = sheetViewData;
    if (worksheetId === this.props.worksheetId && _.find(rows, r => r.rowid === recordId)) {
      getRowDetail({
        checkView: true,
        getType: 1,
        rowId: recordId,
        viewId,
        worksheetId,
        controls,
      }).then(row => {
        if (row.resultCode === 1 && row.isViewData) {
          updateRows(
            [recordId],
            [{}, ...row.formData].reduce((a = {}, b = {}) => Object.assign(a, { [b.controlId]: b.value })),
          );
        } else {
          hideRows([recordId]);
        }
      });
    }
  }

  @autobind
  handleCellClick(cell, row, rowIndex) {
    const { setHighLight } = this.props;
    setHighLight(this.tableId, rowIndex);
    const newState = {
      recordInfoVisible: true,
      recordId: row.rowid,
    };
    if (cell.type === 29 && cell.enumDefault === 2) {
      newState.activeRelateTableControlIdOfRecord = cell.controlId;
    }
    this.setState(newState);
  }

  @autobind
  handleCellMouseDown({ rowIndex }) {
    const { setHighLight } = this.props;
    setHighLight(this.tableId, rowIndex);
  }

  get columns() {
    const { view, controls, showControlIds = [] } = this.props;
    const { sheetHiddenColumns } = this.props.sheetViewConfig;
    if (showControlIds && showControlIds.length) {
      return showControlIds.map(cid => _.find(controls, { controlId: cid })).filter(_.identity);
    }
    let columns = [];
    let filteredControls = controls
      .map(c => ({ ...c }))
      .filter(
        control =>
          control.type !== 43 &&
          control.type !== 22 &&
          control.type !== 10010 &&
          !_.find(sheetHiddenColumns.concat(view.controls), cid => cid === control.controlId) &&
          controlState(control).visible,
      );
    let { showControls = [] } = view || {};
    let { customdisplay = '0', sysids = '[]', syssort = '[]' } = getAdvanceSetting(view); // '0':表格显示列与表单中的字段保持一致 '1':自定义显示列
    if (showControls.length) {
      customdisplay = '1';
    }

    if (customdisplay === '1') {
      columns = _.uniqBy(showControls)
        .map(id => _.find(filteredControls, c => c.controlId === id))
        .filter(_.identity);
    } else {
      try {
        sysids = JSON.parse(sysids);
        syssort = JSON.parse(syssort);
      } catch (err) {
        sysids = [];
        syssort = [];
      }
      columns = filteredControls
        .filter(c => !_.includes(['ownerid', 'caid', 'ctime', 'utime'], c.controlId))
        .slice(0)
        .sort((a, b) => (a.row * 10 + a.col > b.row * 10 + b.col ? 1 : -1))
        .concat(
          syssort
            .filter(ssid => _.includes(sysids, ssid))
            .map(ssid => _.find(filteredControls, { controlId: ssid }))
            .filter(_.identity),
        );
    }
    if (!columns.length) {
      columns = [{}];
    }
    return columns;
  }

  get lineNumberBegin() {
    const { pageIndex, pageSize } = this.props.sheetFetchParams;
    return (pageIndex - 1) * pageSize;
  }

  get chartId() {
    return this.props.chartId || this.props.chartIdFromUrl;
  }
  get readonly() {
    return !!this.chartId;
  }

  get disabledFunctions() {
    const { chartId } = this;
    if (chartId) {
      return ['filter'];
    } else {
      return [];
    }
  }

  get rowHeadOnlyNum() {
    return !!this.chartId;
  }

  @autobind
  renderSummaryCell({ style, columnIndex, rowIndex }) {
    const { viewId, sheetViewData, changeWorksheetSheetViewSummaryType } = this.props;
    const { rowsSummary } = sheetViewData;
    const control = [{ type: 'summaryhead' }].concat(this.columns)[columnIndex];
    return (
      <SummaryCell
        rowHeadOnlyNum={this.rowHeadOnlyNum}
        style={style}
        viewId={viewId}
        summaryType={control && rowsSummary.types[control.controlId]}
        summaryValue={control && rowsSummary.values[control.controlId]}
        control={control}
        changeWorksheetSheetViewSummaryType={changeWorksheetSheetViewSummaryType}
      />
    );
  }

  @autobind
  renderColumnHead({ control, className, style, columnIndex, fixedColumnCount, mdtable, ...rest }) {
    const {
      appId,
      worksheetId,
      viewId,
      view,
      worksheetInfo,
      sheetViewConfig,
      updateDefaultScrollLeft,
      changePageIndex,
      filters,
      quickFilter,
      refresh,
      clearSelect,
      updateRows,
      getWorksheetSheetViewSummary,
      sheetSwitchPermit,
      sheetViewData,
    } = this.props;
    const { projectId } = worksheetInfo;
    const { allWorksheetIsSelected, sheetSelectedRows } = sheetViewConfig;
    return (
      <ColumnHead
        count={sheetViewData.count}
        viewId={viewId}
        className={className}
        style={style}
        control={control}
        disabledFunctions={this.disabledFunctions}
        readonly={this.readonly}
        isLast={control.controlId === _.last(this.columns).controlId}
        columnIndex={columnIndex}
        fixedColumnCount={fixedColumnCount}
        rowIsSelected={!!(allWorksheetIsSelected || sheetSelectedRows.length)}
        canBatchEdit={isOpenPermit(permitList.batchEdit, sheetSwitchPermit, viewId)}
        onBatchEdit={() => {
          editRecord({
            appId,
            viewId,
            projectId,
            activeControl: control,
            view,
            worksheetId,
            searchArgs: filters,
            quickFilter,
            clearSelect,
            allWorksheetIsSelected,
            updateRows,
            getWorksheetSheetViewSummary,
            reloadWorksheet: () => {
              changePageIndex(1);
              refresh();
            },
            selectedRows: sheetSelectedRows,
            worksheetInfo,
          });
        }}
        updateDefaultScrollLeft={({ xOffset = 0 } = {}) => {
          if (mdtable.current) {
            updateDefaultScrollLeft(mdtable.current.scrollLeft + xOffset);
          }
        }}
        {...rest}
      />
    );
  }

  @autobind
  renderRowHead({ className, key, style: cellstyle, columnIndex, rowIndex, scrollTo, control, data }) {
    const {
      isCharge,
      appId,
      view,
      viewId,
      worksheetInfo,
      sheetSwitchPermit,
      buttons,
      sheetViewData,
      sheetViewConfig,
      refreshWorksheetControls,
    } = this.props;
    // functions
    const { addRecord, selectRows, updateRows, hideRows, saveSheetLayout, resetSehetLayout, setHighLight } = this.props;
    const { allowAdd, worksheetId, projectId } = worksheetInfo;
    const { allWorksheetIsSelected, sheetSelectedRows, sheetHiddenColumns } = sheetViewConfig;
    const localLayoutUpdateTime = getLRUWorksheetConfig('SHEET_LAYOUT_UPDATE_TIME', viewId);
    if (_.isEmpty(view) && !this.chartId) {
      return <span />;
    }
    return (
      <RowHead
        count={sheetViewData.count}
        readonly={this.readonly}
        isCharge={isCharge}
        rowHeadOnlyNum={this.rowHeadOnlyNum}
        tableId={this.tableId}
        layoutChangeVisible={
          isCharge &&
          (!!sheetHiddenColumns.length ||
            Number(localLayoutUpdateTime) >
              Number(view.advancedSetting.layoutupdatetime || view.advancedSetting.layoutUpdateTime || 0))
        }
        className={className}
        {...{ appId, viewId, worksheetId }}
        columns={this.columns}
        projectId={projectId}
        allowAdd={allowAdd}
        style={cellstyle}
        lineNumberBegin={this.lineNumberBegin}
        canSelectAll={!!sheetViewData.rows.length}
        allWorksheetIsSelected={allWorksheetIsSelected}
        selectedIds={sheetSelectedRows.map(r => r.rowid)}
        sheetSwitchPermit={sheetSwitchPermit}
        customButtons={buttons}
        onSelectAllWorksheet={value => {
          selectRows({
            selectAll: value,
            rows: [],
          });
        }}
        onSelect={(newSelected, selectRowId) => {
          if (allWorksheetIsSelected) {
            selectRows({
              selectAll: false,
              rows: data
                .filter(function (row) {
                  return !_.find(newSelected, function (rowid) {
                    return row.rowid === rowid;
                  });
                })
                .filter(_.identity),
            });
          } else {
            const selectIndex = _.findIndex(data, r => r.rowid === selectRowId);
            if (this.shiftActive) {
              let startIndex = Math.min(...[selectIndex, this.shiftActiveRowIndex]);
              let endIndex = Math.max(...[selectIndex, this.shiftActiveRowIndex]);
              if (endIndex > data.length - 1) {
                endIndex = data.length - 1;
              }
              selectRows({
                rows: _.unionBy(data.slice(startIndex, endIndex + 1).concat(sheetSelectedRows), 'rowid'),
              });
            } else {
              this.shiftActiveRowIndex = selectIndex;
              selectRows({
                rows: newSelected.map(rowid => _.find(data, row => row.rowid === rowid)).filter(_.identity),
              });
            }
          }
        }}
        onReverseSelect={() => {
          if (allWorksheetIsSelected) {
            selectRows({
              selectAll: false,
              rows: [],
            });
          } else {
            selectRows({
              rows: data.filter(r => !_.find(sheetSelectedRows, row => row.rowid === r.rowid)).filter(_.identity),
            });
          }
        }}
        updateRows={updateRows}
        hideRows={hideRows}
        rowIndex={rowIndex}
        data={data}
        handleAddSheetRow={addRecord}
        saveSheetLayout={saveSheetLayout}
        resetSehetLayout={resetSehetLayout}
        setHighLight={setHighLight}
        refreshWorksheetControls={refreshWorksheetControls}
      />
    );
  }

  asyncUpdate(row, cell, options) {
    const { worksheetInfo, updateControlOfRow, controls, sheetSearchConfig } = this.props;
    const { projectId } = worksheetInfo;
    const asyncUpdateCell = (cid, newValue) => {
      if (typeof newValue === 'object') {
        return;
      }
      updateControlOfRow(
        { recordId: row.rowid, cell: { controlId: cid, value: newValue } },
        {
          updateSucessCb: needUpdateRow => {
            this.table.current.table.updateSheetRow({ ...needUpdateRow, allowedit: true, allowdelete: true });
          },
        },
      );
    };
    const dataFormat = new DataFormat({
      data: controls.filter(c => c.advancedSetting).map(c => ({ ...c, value: (row || {})[c.controlId] || c.value })),
      projectId,
      // masterData,
      searchConfig: sheetSearchConfig,
      onAsyncChange: changes => {
        if (!_.isEmpty(changes.controlIds)) {
          changes.controlIds.forEach(cid => {
            asyncUpdateCell(cid, changes.value);
          });
        } else if (changes.controlId) {
          asyncUpdateCell(changes.controlId, changes.value);
        }
      },
    });
    dataFormat.updateDataSource(cell);
    const data = dataFormat.getDataSource();
    const updatedIds = dataFormat.getUpdateControlIds();
    const updatedCells = data
      .filter(c => _.includes(updatedIds, c.controlId))
      .map(c => _.pick(c, ['controlId', 'controlName', 'type', 'value']));
    updatedCells.forEach(c => {
      if (c.controlId === cell.controlId) {
        c.editType = cell.editType;
      }
    });
    updateControlOfRow({ cell, cells: updatedCells, recordId: row.rowid }, options);
  }

  render() {
    const {
      isCharge,
      sheetViewData,
      sheetViewConfig,
      appId,
      groupId,
      view,
      viewId,
      sheetSwitchPermit,
      worksheetInfo,
      filters,
      quickFilter,
      controls,
    } = this.props;
    // function
    const {
      addRecord,
      updateRows,
      hideRows,
      getWorksheetSheetViewSummary,
      updateSheetColumnWidths,
      updateWorksheetSomeControls,
      openNewRecord,
    } = this.props;
    const { readonly } = this;
    const { loading, rows } = sheetViewData;
    const { sheetSelectedRows = [], sheetColumnWidths, fixedColumnCount, defaultScrollLeft } = sheetViewConfig;
    const { worksheetId, projectId, allowAdd, rules = [], isWorksheetQuery } = worksheetInfo;
    const { recordId, recordInfoVisible, activeRelateTableControlIdOfRecord, tempViewIdForRecordInfo } = this.state;
    const { lineNumberBegin, columns } = this;
    const needClickToSearch = !readonly && _.get(view, 'advancedSetting.clicksearch') === '1';
    const numberWidth = String(lineNumberBegin + rows.length).length * 8;
    let rowHeadWidth = (numberWidth > 14 ? numberWidth : 14) + 40 + 24;
    if (this.rowHeadOnlyNum) {
      rowHeadWidth = (numberWidth > 14 ? numberWidth : 14) + 24;
    }
    return (
      <React.Fragment>
        {recordInfoVisible && (
          <RecordInfo
            controls={controls}
            sheetSwitchPermit={sheetSwitchPermit}
            projectId={projectId}
            showPrevNext
            needUpdateRows
            rules={rules}
            isWorksheetQuery={isWorksheetQuery}
            isCharge={isCharge}
            allowAdd={allowAdd}
            appId={appId}
            viewId={tempViewIdForRecordInfo || viewId}
            appSectionId={groupId}
            view={view}
            visible={recordInfoVisible}
            hideRecordInfo={closeId => {
              if (!closeId || closeId === this.state.recordId) {
                this.setState({ recordInfoVisible: false, tempViewIdForRecordInfo: undefined });
              }
            }}
            recordId={recordId}
            activeRelateTableControlId={activeRelateTableControlIdOfRecord}
            worksheetId={worksheetId}
            updateWorksheetControls={updateWorksheetSomeControls}
            updateRows={updateRows}
            hideRows={hideRows}
            onDeleteSuccess={() => {
              hideRows([recordId]);
            }}
            getWorksheetSummary={getWorksheetSheetViewSummary}
            currentSheetRows={rows}
            handleAddSheetRow={addRecord}
          />
        )}
        {loading && (
          <React.Fragment>
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
          </React.Fragment>
        )}
        {!loading && (
          <WorksheetTable
            readonly={readonly}
            ref={this.table}
            watchHeight
            id={this.tableId}
            viewId={viewId}
            appId={appId}
            rules={rules}
            worksheetId={worksheetId}
            lineeditable={isOpenPermit(permitList.quickSwitch, sheetSwitchPermit, viewId)}
            fixedColumnCount={fixedColumnCount}
            sheetColumnWidths={sheetColumnWidths}
            allowAdd={isOpenPermit(permitList.createButtonSwitch, sheetSwitchPermit) && allowAdd}
            canSelectAll={!!rows.length}
            data={rows}
            rowHeight={ROW_HEIGHT[view.rowHeight] || 34}
            sheetIsFiltered={!!(filters.keyWords || filters.filterControls.length || !_.isEmpty(quickFilter))}
            showNewRecord={openNewRecord}
            defaultScrollLeft={defaultScrollLeft}
            sheetSwitchPermit={sheetSwitchPermit}
            noFillRows
            selectedIds={sheetSelectedRows.map(r => r.rowid)}
            lineNumberBegin={lineNumberBegin}
            rowHeadOnlyNum={this.rowHeadOnlyNum}
            rowHeadWidth={rowHeadWidth}
            controls={controls}
            columns={columns}
            projectId={projectId}
            keyWords={filters.keyWords}
            showSummary={!this.chartId}
            onCellClick={this.handleCellClick}
            onCellMouseDown={this.handleCellMouseDown}
            renderFooterCell={this.renderSummaryCell}
            renderColumnHead={this.renderColumnHead}
            renderRowHead={this.renderRowHead}
            noRecordAllowAdd={false}
            emptyIcon={needClickToSearch && _.isEmpty(quickFilter) ? <span /> : undefined}
            emptyText={
              needClickToSearch && _.isEmpty(quickFilter) ? (
                <span className="Font14">{_l('执行查询后显示结果')}</span>
              ) : undefined
            }
            updateCell={({ cell, row }, options) => {
              this.asyncUpdate(row, cell, options);
            }}
            onColumnWidthChange={updateSheetColumnWidths}
          />
        )}
      </React.Fragment>
    );
  }
}

export default connect(
  state => ({
    // worksheet
    isCharge: state.sheet.isCharge,
    worksheetInfo: state.sheet.worksheetInfo,
    filters: state.sheet.filters,
    quickFilter: state.sheet.quickFilter,
    navGroupFilters: state.sheet.navGroupFilters,
    buttons: state.sheet.buttons,
    controls: state.sheet.controls,
    sheetSwitchPermit: state.sheet.sheetSwitchPermit || [],
    sheetSearchConfig: state.sheet.sheetSearchConfig || [],
    chartIdFromUrl: _.get(state, 'sheet.base.chartId'),
    // sheetview
    sheetViewData: state.sheet.sheetview.sheetViewData,
    sheetFetchParams: state.sheet.sheetview.sheetFetchParams,
    sheetViewConfig: state.sheet.sheetview.sheetViewConfig,
  }),
  dispatch =>
    bindActionCreators(
      {
        ..._.pick(sheetviewActions, [
          'setRowsEmpty',
          'addRecord',
          'fetchRows',
          'updateRows',
          'hideRows',
          'selectRows',
          'clearHighLight',
          'setHighLight',
          'updateDefaultScrollLeft',
          'updateSheetColumnWidths',
          'changeWorksheetSheetViewSummaryType',
          'updateViewPermission',
          'getWorksheetSheetViewSummary',
          'changePageIndex',
          'updateControlOfRow',
          'refresh',
          'clearSelect',
          'saveSheetLayout',
          'resetSehetLayout',
        ]),
        updateWorksheetSomeControls,
        refreshWorksheetControls,
      },
      dispatch,
    ),
)(TableView);
