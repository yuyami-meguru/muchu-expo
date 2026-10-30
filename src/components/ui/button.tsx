import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cx } from "./cx";

/** Figma の 種類：主＝primary・普通＝secondary・控えめ＝ghost・危険＝danger・LINE＝line */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "line";
/** Figma の 大きさ：大＝lg（52px）・中＝md（44px）・小＝sm（36px） */
export type ButtonSize = "lg" | "md" | "sm";

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 文字の左に出すアイコン */
  icon?: IconName;
  /** 文字の右に出すアイコン（「右へ」など） */
  iconRight?: IconName;
  /** 横いっぱいに広げる */
  block?: boolean;
  children: ReactNode;
  className?: string;
};

type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & {
  href?: undefined;
  /**
   * 送信中。もう一度押しても何もしない（二重に送らない）。「送信中」と読み上げる。
   * disabled にはしない（押したボタンから選んだ印が消えて、キーボードやスイッチで使う人が場所を見失うため）
   */
  pending?: boolean;
};

type AsLink = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "className" | "href"> & {
  href: string;
  pending?: undefined;
};

export type ButtonProps = AsButton | AsLink;

export function buttonClass({ variant = "secondary", size = "md", block, className }: Pick<Common, "variant" | "size" | "block" | "className">) {
  return cx("ui-btn", `ui-btn--${variant}`, `ui-btn--${size}`, block && "ui-btn--block", className);
}

/**
 * ボタン。href を渡すとリンク（外のサイトなら新しいタブ）になる。
 * いちばん目立つ primary は 1 画面に 1 つだけ。
 */
export function Button(props: ButtonProps) {
  const { variant = "secondary", size = "md", icon, iconRight, block, children, className } = props;
  const cls = buttonClass({ variant, size, block, className });
  const iconSize = size === "sm" ? 16 : 20;
  const inner = (
    <>
      {icon && <Icon name={icon} size={iconSize} />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </>
  );

  if (props.href !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { variant: _v, size: _s, icon: _i, iconRight: _r, block: _b, children: _c, className: _cl, pending: _p, href, ...rest } = props;
    if (/^(https?:|mailto:|tel:)/.test(href)) {
      const external = href.startsWith("http");
      return (
        <a href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...rest}>
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} {...rest}>
        {inner}
      </Link>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { variant: _v, size: _s, icon: _i, iconRight: _r, block: _b, children: _c, className: _cl, pending, type = "button", disabled, onClick, href: _h, ...rest } = props;
  // 送信中に押されたら止める（フォームの送信も）。pending を使わないボタン（サーバーの画面のものも）は、渡された onClick のまま
  const click: typeof onClick =
    pending === undefined
      ? onClick
      : (e) => {
          if (pending) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        };
  return (
    <button type={type} className={cls} disabled={disabled} aria-disabled={pending || undefined} aria-busy={pending || undefined} onClick={click} {...rest}>
      {pending ? (
        <>
          <span className="ui-btn-spin" aria-hidden="true" />
          <span>{children}</span>
          <span className="sr-only">送信中</span>
        </>
      ) : (
        inner
      )}
    </button>
  );
}

/** アイコンだけのボタン（ベル・さがす・メニュー）。読み上げ用の label は必ず付ける */
export function IconButton({
  icon,
  label,
  href,
  dot,
  size = 22,
  className,
  ...rest
}: { icon: IconName; label: string; href?: string; dot?: boolean; size?: number; className?: string } & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className"
>) {
  const inner = (
    <>
      <Icon name={icon} size={size} />
      <span className="sr-only">{label}</span>
      {dot && <span className="ui-dot" aria-hidden="true" />}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cx("ui-icon-btn", className)} title={label}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={cx("ui-icon-btn", className)} title={label} {...rest}>
      {inner}
    </button>
  );
}
