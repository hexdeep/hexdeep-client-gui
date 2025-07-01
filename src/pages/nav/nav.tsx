import { animate } from 'animejs';
import Vue from "vue";
import { Component, Ref, Watch } from "vue-property-decorator";
import { EditPassDialog } from "./edit_pass";
import s from './nav.module.less';
import { Config } from '@/common/Config';
import { Menu } from 'element-ui';

@Component
export default class Nav extends Vue {
    @Ref() private animationBgRef!: HTMLDivElement;
    @Ref() private animationBgRef2!: HTMLDivElement;

    private menus: NavData[] = [
        {
            label: 'nav.vms',
            path: '/vm',
            icon: 'icon-a-xunijibeifen2'
        },
        {
            label: 'nav.instances',
            path: '/instance',
            icon: 'icon-a-shebeibeifen2'
        },
        // {
        //     label: 'machines',
        //     path: '/machine',
        //     icon: 'icon-kongxianxuniji'
        // },
        {
            label: 'nav.orders',
            path: '/order',
            icon: 'icon-dingdan'
        },
        {
            label: 'nav.apiDoc',
            path: `http://${Config.host}/api`,
            blank: true,
            icon: 'icon-shiyongwendang'
        },
        {
            label: 'nav.openSource',
            path: 'https://github.com/hexdeep/hexdeep-client-gui',
            blank: true,
            icon: 'icon-github-fill'
        },
    ];

    private onCommand(cmd: string) {
        switch (cmd) {
            case 'to_home':
                window.open("https://www.haoyun.pro", '_blank');
                break;
            case 'edit_pass':
                this.$dialog(EditPassDialog).show();
                break;
            case 'logout':
                // this.$router.replace({ name: "login" });
                break;
        }
    }

    protected mounted() {
        const activeLink = document.querySelector(`.${s.menu}.router-link-exact-active`) as HTMLElement;
        if (activeLink) {
            const rect = activeLink.getBoundingClientRect();
            this.animationBgRef.style.width = `${rect.width}px`;
            this.animationBgRef.style.transform = `translateX(${activeLink.offsetLeft - 20}px)`;
            this.animationBgRef.style.opacity = "0";
            this.animationBgRef2.style.width = `${rect.width}px`;
            this.animationBgRef2.style.transform = `translateX(${activeLink.offsetLeft - 20}px)`;
        }
    }

    @Watch('$route')
    protected activeChange() {
        setTimeout(() => {
            const activeLink = document.querySelector(`.${s.menu}.router-link-exact-active`) as HTMLElement;
            if (activeLink) {
                animate(this.animationBgRef2, {
                    transform: `translateX(${activeLink.offsetLeft - 20}px)`, width: `${activeLink.offsetWidth}px`,
                    easing: 'easeOutQuad',
                    duration: 300,
                });
            }
        }, 10);
    }

    private onMouseenter(e: MouseEvent) {
        const target = e.target as HTMLElement;
        animate(this.animationBgRef, {
            transform: `translateX(${target.offsetLeft - 20}px)`, width: `${target.offsetWidth}px`,
            opacity: 1,
            easing: 'easeOutQuad',
            duration: 300,
        });
    }

    private onMouseleave(e: MouseEvent) {
        const activeLink = document.querySelector(`.${s.menu}.router-link-exact-active`) as HTMLElement;
        animate(this.animationBgRef, {
            transform: `translateX(${activeLink.offsetLeft - 20}px)`, width: `${activeLink.offsetWidth}px`,
            opacity: 0,
            easing: 'easeOutQuad',
            duration: 300,
        });
    }

    private selectLang(lang: string) {
        this.$i18n.locale = lang;
        this.activeChange();
        localStorage.setItem('lang', lang);
    }

    protected onClick(e: any, data: NavData) {
        if (data.path.startsWith("http")) {
            window.open(data.path, '_blank');
            e.stopPropagation();
        }
    }

    protected render() {
        return (
            <div class={s.header}>
                <div class={s.top}>
                    <div class={s.title}>HEXDEEP</div>
                    <div class={s.menuBox}>
                        <div ref="animationBgRef" class={s.animationBg} style={{ filter: "blur(5px)", }} />
                        <div ref="animationBgRef2" class={s.animationBg} />
                        {this.menus.map(menu => (
                            <router-link nativeOnClick={(e) => this.onClick(e, menu)} nativeOnMouseenter={this.onMouseenter} target={menu.blank ? "_blank" : "_self"} nativeOnMouseleave={this.onMouseleave} draggable={false} exact to={menu.path} class={s.menu} >
                                <i class={`iconfont ${menu.icon}`} />
                                <span>{this.$t(menu.label)}</span>
                            </router-link>
                        ))}
                    </div>
                    <el-dropdown onCommand={this.selectLang}>
                        <div class={s.tools}>
                            <i class="iconfont icon-fanyi-01" style={{ fontSize: "25px" }} />
                        </div>
                        <el-dropdown-menu slot="dropdown">
                            <el-dropdown-item command="zh">中文</el-dropdown-item>
                            <el-dropdown-item command="en">English</el-dropdown-item>
                        </el-dropdown-menu>
                    </el-dropdown>
                    <el-dropdown onCommand={this.onCommand}>
                        <div class={s.tools}>
                            <div class={s.avatar}><i class="iconfont icon-a-weibiaoti-1_huaban1fuben7" /></div>
                            <div>Admin</div>
                        </div>
                        <el-dropdown-menu slot="dropdown">
                            <el-dropdown-item command="to_home">{this.$t("officialWebsite")}</el-dropdown-item>
                            {/* <el-dropdown-item command="edit_pass" divided>{this.$t("changePassword")}</el-dropdown-item>
                            <el-dropdown-item command="logout">{this.$t("logout")}</el-dropdown-item> */}
                        </el-dropdown-menu>
                    </el-dropdown>
                </div>
            </div>
        );
    }
}

interface NavData {
    label: string;
    path: string;
    icon: string;
    blank?: boolean;
}