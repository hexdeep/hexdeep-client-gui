import { makeVmApiUrl, timeDiff } from "@/common/common";
import { ApiBase } from "./api_base";
import qs from 'qs';
import { Config } from "@/common/Config";
import { OrderDetail, OrderInfo, RentalInfo, RentalRecord } from "./order_define";


class OrderApi extends ApiBase {
    public async queryOrderState(order_id: string) {
        const result = await fetch(makeVmApiUrl("server/order/query_state", Config.host, order_id));
        return await this.handleError(result);
    }
    public async getRental(device_ids: string) {
        const result = await fetch(makeVmApiUrl("server/device/get", Config.host) + `?device_ids=${device_ids}`);
        var re: RentalRecord[] = await this.handleError(result) ?? [];
        re.forEach(item => {
            item.device_indexes.forEach(x => {             
                var d = timeDiff(x.rental_end_time, x.current_time, "day");
                if (d < 0) {
                    x.state = "expired";
                } else if (d < 7) {
                    x.state = "expiring";
                } else {
                    x.state = "normal";
                }
            });
        });
        return re;
    }
    public async queryOrder(device_ids: string) {
        const result = await fetch(makeVmApiUrl("server/order/get", Config.host) + `?device_ids=${device_ids}`);
        var re: OrderInfo[] = await this.handleError(result);
        re.forEach(x => {
            if (typeof x.detail === 'string') {
                x.detail = JSON.parse(x.detail) as OrderDetail;
            }
        });
        return re;
    }
    public async getPackages() {
        const result = await fetch(makeVmApiUrl("server/rental_config/get", Config.host));
        return await this.handleError(result);
    }

    public async purchase(package_id: number, device_ids: string) {
        var formData = new FormData();
        formData.append('rental_config_id', package_id.toString());
        formData.append('device_indexes', device_ids);
        const result = await fetch(makeVmApiUrl("server/order/add", Config.host), {
            method: 'POST',
            body: formData
        });
        return await this.handleError(result);
    }
}

export const orderApi = new OrderApi();