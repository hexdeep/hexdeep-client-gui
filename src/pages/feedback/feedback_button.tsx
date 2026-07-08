import Vue from "vue";
import { Component } from "vue-property-decorator";
import { FeedbackDialog } from "./feedback_dialog";
import s from './feedback_button.module.less';

@Component
export default class FeedbackButton extends Vue {
    private onClick() {
        this.$dialog(FeedbackDialog).show();
    }

    protected render() {
        return (
            <div class={s.button} onClick={this.onClick}>
                <i class="el-icon-service" />
                <span>{this.$t("feedback.button")}</span>
            </div>
        );
    }
}
