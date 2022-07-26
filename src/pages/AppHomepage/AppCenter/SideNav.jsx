import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import cx from 'classnames';
import Trigger from 'rc-trigger';
import { Tooltip } from 'ming-ui';
import { NATIVE_APP_ITEM } from 'src/pages/AppHomepage/MyApp/config';
import ThirdApp from 'src/pages/AppHomepage/MyApp/MyAppSide/ThirdApp';
import MyProcess from 'src/pages/workflow/MyProcess';
import MyProcessEntry from 'src/pages/workflow/MyProcess/Entry';
import PopupLinks from './components/PopupLinks';
import privateSource from 'src/api/privateSource';
import SvgIcon from 'src/components/SvgIcon';

const {
  app: { appSide, appManagementHeader },
} = window.private;

const Con = styled.div`
  overflow-y: auto;
  overflow-x: hidden;
  background: #f7f8fc;
  transition: width 0.2s;
  width: 68px;
  &.isExpanded {
    width: 180px;
    .moduleEntry,
    .resourceEntry {
      flex-direction: row;
      justify-content: start;
      padding: 0 12px;
      height: 40px;
      .name {
        display: none;
      }
      .fullName {
        display: inline-block;
      }
    }
    .resourceEntry {
      width: 156px;
    }
    .expandBtn {
      justify-content: end;
    }
  }
`;
const Content = styled.div`
  padding: 14px 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100%;
`;

const BaseEntry = styled.a`
  color: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  .fullName {
    display: none;
    margin-left: 8px;
    font-size: 14px;
  }
  &:hover {
    color: inherit;
    background: #fff;
  }
`;

const ModuleEntries = styled.div``;

const ModuleEntry = styled(BaseEntry)`
  margin: 12px 0;
  height: 48px;
  .entryIcon {
    font-size: 24px;
    color: #515151;
  }
  .name {
    font-size: 12px;
  }
  .fullName {
    font-size: 14px;
  }
  .name {
    color: #9e9e9e;
  }
  &.isExpanded {
    width: 164px;
  }
  &.active {
    .entryIcon,
    .fullName,
    .name {
      color: #2196f3;
    }
    background: rgba(33, 150, 243, 0.1);
  }
`;

const Spacer = styled.div`
  flex: 1;
`;
const ResourceEntries = styled.div``;
const ResourceEntry = styled(BaseEntry)`
  margin: 6px auto 0;
  width: 40px;
  height: 40px;
  .entryIcon {
    font-size: 20px;
  }
`;

const ProcessEntry = styled.div`
  position: relative;
  .count {
    cursor: pointer;
    color: #fff;
    position: absolute;
    right: 0px;
    top: -2px;
    border-radius: 20px;
    font-size: 12px;
    text-align: center;
    line-height: 20px;
    width: 20px;
    height: 20px;
    background-color: #ff0000;
    z-index: 1;
    &.isExpanded {
      right: 12px;
      top: 10px;
    }
    &.outed {
      width: auto;
      padding: 0 4px;
    }
  }
`;

const moduleEntries = [
  {
    type: 'app',
    icon: 'widgets',
    name: _l('应用'),
    href: '/app/my',
  },
  {
    type: 'myProcess',
    icon: 'task_alt',
    name: _l('待办'),
    fullName: _l('流程待办'),
  },
  {
    type: 'lib',
    icon: 'custom_store',
    name: _l('应用库'),
    href: '/app/lib',
  },
  {
    type: 'cooperation',
    icon: 'cooperation',
    name: _l('协作'),
  },
];

const resourceEntries = [
  {
    id: 'educate',
    icon: 'school',
    color: '#4CAF50',
    name: _l('学习资源'),
  },
  {
    id: 'recommend',
    icon: 'military_tech',
    color: '#f89802',
    name: _l('推广奖励'),
    href: 'https://www.theportal.cn/portal/app/68d26cff-addd-48ac-8158-af7aa193696f',
  },
  {
    id: 'thirdPartyApp',
    icon: 'sidebar_connection_application',
    color: '#e91d63',
    name: _l('第三方应用'),
  },
  // {
  //   icon: 'hub',
  //   color: '#8B47FF',
  //   name: _l('集成中心'),
  // },
];

const educateEntries = [
  {
    type: 'title',
    title: _l('学习'),
  },
  {
    icon: 'sidebar_video_tutorial',
    name: _l('视频学习'),
    color: '#7C58C2',
    href: 'https://learn.mingdao.net',
  },
  {
    icon: 'help',
    name: _l('帮助文档'),
    color: '#5F7D8B',
    href: 'https://help.mingdao.com',
  },
  {
    icon: 'flag',
    name: _l('实践案例'),
    color: '#2eb240',
    href: 'https://blog.mingdao.com/category/case-study',
  },
  {
    type: 'title',
    title: _l('资源'),
  },
  {
    icon: 'rss_feed',
    color: '#FFA700',
    href: 'https://blog.mingdao.com',
    name: _l('明道云博客'),
  },
  {
    icon: 'zero',
    color: '#2196F3',
    name: _l('零代码社区'),
    href: 'https://bbs.mingdao.net/',
  },
];

export default function SideNav(props) {
  const { active, currentProject } = props;
  const [isExpanded, setIsExpanded] = useState(localStorage.getItem('homeNavIsExpanded') === '1');
  const [countData, setCountData] = useState();
  const [myProcessVisible, setMyProcessVisible] = useState();
  const [thirdPartyAppVisible, setThirdPartyAppVisible] = useState();
  const [sourcesList, setSourcesList] = useState([]);

  useEffect(() => {
    privateSource.getSources({ status: 1 }).then(result => {
      const list = result.map(item => {
        return {
          color: item.color,
          iconUrl: item.iconUrl,
          name: item.name,
          id: item.eventParams ? 'thirdPartyApp' : item.id,
          href: item.linkParams ? item.linkParams.url : null,
        };
      });

      setSourcesList(list);
    });
  }, []);

  return (
    <Con className={cx({ isExpanded })}>
      <Content>
        {myProcessVisible && (
          <MyProcess countData={countData} onCancel={() => setMyProcessVisible(false)} updateCountData={setCountData} />
        )}
        {thirdPartyAppVisible && <ThirdApp onCancel={() => setThirdPartyAppVisible(false)} />}
        <ModuleEntries>
        {moduleEntries
          .filter(
            o =>
              !appManagementHeader[o.type] &&
              !(o.type === 'cooperation' && !NATIVE_APP_ITEM.length) &&
              !(o.type === 'lib' && md.global.SysSettings.hideTemplateLibrary),
          )
          .map((entry, i) => {
            const content = (
              <ModuleEntry
                key={i}
                className={cx('moduleEntry', { active: active === entry.type, isExpanded })}
                href={entry.href}
                onClick={
                  !entry.href
                    ? e => {
                        if (entry.type === 'myProcess') {
                          setMyProcessVisible(true);
                        }
                      }
                    : _.noop
                }
              >
                <i className={`entryIcon icon icon-${entry.icon}`}></i>
                <span className="name">{entry.name}</span>
                <span className="fullName ellipsis">{entry.fullName || entry.name}</span>
              </ModuleEntry>
            );
            if (entry.type === 'myProcess') {
              return (
                <MyProcessEntry
                  countData={countData}
                  updateCountData={setCountData}
                  renderContent={count => (
                    <ProcessEntry isExpanded={isExpanded}>
                      {content}
                      {!!count && (
                        <span
                          className={cx('count', { isExpanded, outed: String(count) === '99+' })}
                          onClick={() => {
                            setMyProcessVisible(true);
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </ProcessEntry>
                  )}
                />
              );
            }
            if (entry.type === 'cooperation') {
              return (
                <Trigger
                  action={['hover']}
                  popupAlign={{
                    points: ['tl', 'tr'],
                    offset: [12, -4],
                  }}
                  popup={
                    <PopupLinks
                      items={NATIVE_APP_ITEM.filter(
                        item =>
                          !_.includes(_.get(md, 'global.Config.ForbidSuites') || [], item.key) &&
                          (item.id !== 'hr' || _.get(currentProject, 'isHrVisible')),
                      )}
                    />
                  }
                >
                  {content}
                </Trigger>
              );
            }
            return content;
          })}
        </ModuleEntries>
        <Spacer />
        <ResourceEntries>
        {resourceEntries
          .filter(o => !appSide[o.id])
          .concat(sourcesList)
          .map((entry, index) => {
            const content = (
              <ResourceEntry
                {...(entry.href ? { target: '_blank' } : {})}
                className="resourceEntry"
                key={index}
                href={entry.href}
                onClick={() => {
                  if (!entry.href) {
                    if (entry.id === 'thirdPartyApp') {
                      setThirdPartyAppVisible(true);
                    }
                  }
                }}
              >
                {entry.icon && <i className={`entryIcon icon icon-${entry.icon}`} style={{ color: entry.color }} />}
                {entry.iconUrl && <SvgIcon size="18" fill={entry.color} url={entry.iconUrl} />}
                <span className="fullName ellipsis">{entry.name}</span>
              </ResourceEntry>
            );
            if (entry.id === 'educate') {
              return (
                <Trigger
                  action={['hover']}
                  popupAlign={{
                    points: ['tl', 'tr'],
                    offset: [16, -108],
                    overflow: { adjustY: true },
                  }}
                  popup={<PopupLinks openInNew items={educateEntries} />}
                  mouseLeaveDelay={0.2}
                >
                  {content}
                </Trigger>
              );
            }
            if (!isExpanded && _.includes(['recommend', 'thirdPartyApp'], entry.id)) {
              return (
                <Tooltip popupPlacement="right" text={<span>{entry.name}</span>}>
                  {content}
                </Tooltip>
              );
            }
            return content;
          })}
          <ResourceEntry
            className="resourceEntry expandBtn"
            onClick={() => {
              setIsExpanded(!isExpanded);
              localStorage.setItem('homeNavIsExpanded', !isExpanded ? '1' : '');
            }}
          >
            <span className="fullName Font12 Gray_9e flex" style={{marginLeft: '25px' }}>{_l('v%0', md.global.Config.Version)}</span>
            <i className={`entryIcon icon ${isExpanded ? 'icon-menu_left' : 'icon-menu_right'} Gray_75`}></i>
          </ResourceEntry>
        </ResourceEntries>
      </Content>
    </Con>
  );
}
