import { Icon } from "@/components/icons";
import { appleMapsUrl, embedMapUrl, googleMapsUrl, VENUE } from "@/lib/venue";
import "./access.css";

/** 会場への地図。Apple マップをいちばん上に、Google マップも。正確な位置が入っていれば地図も埋め込む */
export function AccessMap() {
  const embed = embedMapUrl();
  return (
    <div className="ac">
      {embed && (
        <div className="ac-embed">
          <iframe src={embed} title={`${VENUE.name}の地図`} loading="lazy" />
        </div>
      )}
      <div className="ac-btns">
        <a className="ac-btn ac-btn--apple" href={appleMapsUrl()} target="_blank" rel="noopener noreferrer">
          <Icon name="地図" size={20} />
          Apple マップで開く
        </a>
        <a className="ac-btn" href={googleMapsUrl()} target="_blank" rel="noopener noreferrer">
          <Icon name="道案内" size={20} />
          Google マップで開く
        </a>
      </div>
    </div>
  );
}
