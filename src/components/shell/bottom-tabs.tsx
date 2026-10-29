import { Icon } from "@/components/icons";
import type { NavItem } from "./nav-items";
import { NavLink } from "./nav-link";

/**
 * スマホの下の固定メニュー（59:52）。5 つまで。親指で届く所に。
 * iPhone の下のバーにかからないよう、safe-area の分だけ下をあける。
 */
export function BottomTabs({ items, overflow, active, label = "メニュー" }: {
  items: NavItem[];
  /** 下のメニューに無い画面（左のメニューの項目）。開いているときは最後の項目（その他）を選んだ形にする */
  overflow?: NavItem[];
  active?: string;
  label?: string;
}) {
  return (
    <nav className="shell-tabs" aria-label={label}>
      <ul style={{ ["--tab-count" as string]: items.length }}>
        {items.map((i) => {
          return (
            <li key={i.key}>
              <NavLink item={i} siblings={items} overflow={overflow} active={active} className="shell-tab">
                <span className="shell-tab-icon">
                  <Icon name={i.icon} size={22} />
                  {(i.dot || !!i.count) && <span className="ui-dot shell-tab-dot" aria-hidden="true" />}
                </span>
                <span className="shell-tab-label">{i.short ?? i.label}</span>
                {!!i.count && <span className="sr-only">（{i.count} 件）</span>}
                {i.dot && !i.count && <span className="sr-only">（新しいものがあります）</span>}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
