import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Shield, Scale, Clock, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function Legal() {
  const [activeTab, setActiveTab] = useState('termos');
  const lastUpdated = '08 de Janeiro de 2026';

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Documentação Legal</h1>
          <p className="text-muted-foreground mt-2">
            Termos de Uso, Política de Privacidade e Responsabilidades
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Última atualização: {lastUpdated}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto gap-1">
            <TabsTrigger value="termos" className="flex items-center gap-2 text-xs sm:text-sm">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Termos de Uso</span>
              <span className="sm:hidden">Termos</span>
            </TabsTrigger>
            <TabsTrigger value="privacidade" className="flex items-center gap-2 text-xs sm:text-sm">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Privacidade</span>
              <span className="sm:hidden">Priv.</span>
            </TabsTrigger>
            <TabsTrigger value="sla" className="flex items-center gap-2 text-xs sm:text-sm">
              <Clock className="w-4 h-4" />
              SLA
            </TabsTrigger>
            <TabsTrigger value="lgpd" className="flex items-center gap-2 text-xs sm:text-sm">
              <Database className="w-4 h-4" />
              LGPD
            </TabsTrigger>
            <TabsTrigger value="responsabilidades" className="flex items-center gap-2 text-xs sm:text-sm">
              <Scale className="w-4 h-4" />
              <span className="hidden sm:inline">Responsab.</span>
              <span className="sm:hidden">Resp.</span>
            </TabsTrigger>
          </TabsList>

          {/* Termos de Uso */}
          <TabsContent value="termos" className="mt-6">
            <div className="bg-card rounded-xl p-6 shadow-card">
              <ScrollArea className="h-[70vh] pr-4">
                <div className="prose prose-invert max-w-none space-y-6">
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-6 h-6 text-primary" />
                    Termos de Uso do Morphews CRM
                  </h2>

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <p className="text-amber-200 text-sm">
                      <strong>IMPORTANTE:</strong> Ao utilizar o Morphews CRM, você declara ter lido, compreendido e 
                      concordado integralmente com todos os termos descritos neste documento. O uso continuado 
                      da plataforma implica aceitação automática de quaisquer atualizações futuras.
                    </p>
                  </div>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">1. Definições</h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li><strong>"Plataforma"</strong>: Sistema Morphews CRM, incluindo todas as funcionalidades, APIs e integrações.</li>
                      <li><strong>"Contratante"</strong>: Pessoa física ou jurídica que contrata e utiliza os serviços da Plataforma.</li>
                      <li><strong>"Dados do Contratante"</strong>: Todas as informações inseridas pelo Contratante na Plataforma, incluindo dados de clientes, vendas, leads e comunicações.</li>
                      <li><strong>"Usuários"</strong>: Pessoas autorizadas pelo Contratante a acessar a Plataforma.</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">2. Objeto do Contrato</h3>
                    <p className="text-muted-foreground">
                      A Plataforma oferece serviços de gestão de relacionamento com clientes (CRM), incluindo:
                    </p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                      <li>Gestão de leads e funil de vendas</li>
                      <li>Integração com WhatsApp para comunicação</li>
                      <li>Controle de vendas e entregas</li>
                      <li>Relatórios e dashboards</li>
                      <li>Gestão de equipe e permissões</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">3. Licença de Uso</h3>
                    <p className="text-muted-foreground">
                      Concedemos ao Contratante uma licença limitada, não exclusiva, não transferível e revogável 
                      para utilizar a Plataforma durante a vigência da contratação, exclusivamente para fins 
                      comerciais legítimos e de acordo com estes Termos.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">4. Obrigações do Contratante</h3>
                    <p className="text-muted-foreground font-semibold">O Contratante se compromete a:</p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li>Fornecer informações verdadeiras e atualizadas no cadastro</li>
                      <li>Manter a confidencialidade de suas credenciais de acesso</li>
                      <li>Responsabilizar-se por todas as ações realizadas em sua conta</li>
                      <li>Garantir que possui autorização para coletar e tratar dados de seus clientes</li>
                      <li>Utilizar a Plataforma apenas para fins lícitos</li>
                      <li>Não utilizar a Plataforma para envio de SPAM ou mensagens não solicitadas</li>
                      <li>Realizar backups periódicos de seus dados</li>
                      <li>Comunicar imediatamente qualquer uso não autorizado de sua conta</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">5. Propriedade dos Dados</h3>
                    <p className="text-muted-foreground">
                      <strong>Os Dados do Contratante permanecem de propriedade exclusiva do Contratante.</strong> 
                      A Plataforma atua apenas como processadora desses dados, conforme instruções do Contratante 
                      e nos limites necessários para prestação dos serviços.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">6. Pagamento e Cancelamento</h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li>Os valores são cobrados conforme plano contratado, com vencimento mensal</li>
                      <li>O não pagamento pode resultar em suspensão ou cancelamento do acesso</li>
                      <li>O cancelamento pode ser solicitado a qualquer momento, sem multa</li>
                      <li>Após cancelamento, os dados serão mantidos por 30 dias para exportação</li>
                      <li>Não há reembolso proporcional por período não utilizado</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">7. Modificações nos Termos</h3>
                    <p className="text-muted-foreground">
                      Reservamo-nos o direito de modificar estes Termos a qualquer momento. Alterações significativas 
                      serão comunicadas com 15 dias de antecedência. O uso continuado da Plataforma após as 
                      modificações constitui aceitação dos novos termos.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">8. Rescisão</h3>
                    <p className="text-muted-foreground">
                      Podemos suspender ou encerrar o acesso do Contratante imediatamente, sem aviso prévio, em caso de:
                    </p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                      <li>Violação destes Termos</li>
                      <li>Uso ilegal ou fraudulento da Plataforma</li>
                      <li>Atividades que prejudiquem outros usuários ou a infraestrutura</li>
                      <li>Inadimplência por período superior a 30 dias</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">9. Foro</h3>
                    <p className="text-muted-foreground">
                      Fica eleito o foro da comarca de Porto Alegre/RS para dirimir quaisquer questões 
                      decorrentes destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja.
                    </p>
                  </section>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Política de Privacidade */}
          <TabsContent value="privacidade" className="mt-6">
            <div className="bg-card rounded-xl p-6 shadow-card">
              <ScrollArea className="h-[70vh] pr-4">
                <div className="prose prose-invert max-w-none space-y-6">
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Shield className="w-6 h-6 text-primary" />
                    Política de Privacidade
                  </h2>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">1. Dados que Coletamos</h3>
                    <p className="text-muted-foreground">Coletamos os seguintes tipos de dados:</p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li><strong>Dados de Cadastro:</strong> Nome, e-mail, telefone, CNPJ/CPF</li>
                      <li><strong>Dados de Uso:</strong> Logs de acesso, funcionalidades utilizadas, endereço IP</li>
                      <li><strong>Dados Inseridos:</strong> Informações de leads, clientes, vendas e comunicações inseridas pelo Contratante</li>
                      <li><strong>Dados de Pagamento:</strong> Processados por terceiros (gateways de pagamento)</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">2. Finalidade do Tratamento</h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li>Prestação dos serviços contratados</li>
                      <li>Comunicação sobre atualizações e novidades</li>
                      <li>Suporte técnico</li>
                      <li>Melhorias na Plataforma</li>
                      <li>Cumprimento de obrigações legais</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">3. Compartilhamento de Dados</h3>
                    <p className="text-muted-foreground">
                      <strong>Não vendemos, alugamos ou compartilhamos dados pessoais</strong> com terceiros 
                      para fins de marketing. Podemos compartilhar dados apenas:
                    </p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                      <li>Com prestadores de serviços essenciais (hospedagem, pagamentos)</li>
                      <li>Por determinação legal ou judicial</li>
                      <li>Para proteger direitos, propriedade ou segurança</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">4. Segurança dos Dados</h3>
                    <p className="text-muted-foreground">Implementamos medidas de segurança incluindo:</p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li>Criptografia de dados em trânsito (TLS/SSL)</li>
                      <li>Criptografia de dados em repouso</li>
                      <li>Isolamento por tenant (multi-tenancy seguro)</li>
                      <li>Controle de acesso baseado em funções (RBAC)</li>
                      <li>Backups automáticos diários</li>
                      <li>Monitoramento contínuo de segurança</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">5. Retenção de Dados</h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li>Dados são mantidos enquanto a conta estiver ativa</li>
                      <li>Após cancelamento: 30 dias para exportação, depois exclusão</li>
                      <li>Dados fiscais: mantidos pelo prazo legal (5 anos)</li>
                      <li>Logs de segurança: mantidos por 12 meses</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">6. Cookies e Tecnologias</h3>
                    <p className="text-muted-foreground">
                      Utilizamos cookies essenciais para funcionamento da Plataforma, autenticação 
                      e preferências do usuário. Não utilizamos cookies de terceiros para rastreamento.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">7. Seus Direitos</h3>
                    <p className="text-muted-foreground">Você tem direito a:</p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                      <li>Acessar seus dados pessoais</li>
                      <li>Corrigir dados incorretos</li>
                      <li>Solicitar exclusão de dados</li>
                      <li>Exportar seus dados (portabilidade)</li>
                      <li>Revogar consentimento</li>
                    </ul>
                    <p className="text-muted-foreground mt-2">
                      Solicitações podem ser feitas através do suporte ou pela funcionalidade de backup do sistema.
                    </p>
                  </section>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* SLA */}
          <TabsContent value="sla" className="mt-6">
            <div className="bg-card rounded-xl p-6 shadow-card">
              <ScrollArea className="h-[70vh] pr-4">
                <div className="prose prose-invert max-w-none space-y-6">
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Clock className="w-6 h-6 text-primary" />
                    Acordo de Nível de Serviço (SLA)
                  </h2>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <p className="text-blue-200 text-sm">
                      Este SLA define os níveis de serviço que nos comprometemos a entregar. 
                      Entretanto, o Contratante reconhece que nenhum sistema é infalível e que 
                      interrupções podem ocorrer.
                    </p>
                  </div>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">1. Disponibilidade</h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li><strong>Meta de Uptime:</strong> 99% mensal (aproximadamente 7h de indisponibilidade permitida/mês)</li>
                      <li><strong>Manutenções Programadas:</strong> Não contabilizadas no cálculo de uptime</li>
                      <li><strong>Aviso de Manutenção:</strong> Quando possível, 24h de antecedência</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">2. Exclusões do SLA</h3>
                    <p className="text-muted-foreground font-semibold">O SLA não se aplica a indisponibilidades causadas por:</p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li>Ações ou omissões do Contratante ou seus usuários</li>
                      <li>Falhas de conexão de internet do Contratante</li>
                      <li>Problemas com serviços de terceiros (WhatsApp, gateways de pagamento)</li>
                      <li>Ataques cibernéticos (DDoS, invasões)</li>
                      <li>Casos fortuitos ou força maior</li>
                      <li>Manutenções programadas ou emergenciais</li>
                      <li>Uso além dos limites contratados</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">3. Suporte Técnico</h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li><strong>Canal:</strong> WhatsApp e E-mail</li>
                      <li><strong>Horário:</strong> Segunda a Sexta, 9h às 18h (horário de Brasília)</li>
                      <li><strong>Tempo de Primeira Resposta:</strong> Até 24 horas úteis</li>
                      <li><strong>Tempo de Resolução:</strong> Variável conforme complexidade</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">4. Backups</h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li>Backups automáticos diários são realizados pela infraestrutura</li>
                      <li>Retenção de backups: 7 dias</li>
                      <li><strong>O Contratante é responsável por manter seus próprios backups</strong> através da funcionalidade de exportação</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">5. Integrações de Terceiros</h3>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-2">
                      <p className="text-red-200 text-sm">
                        <strong>ATENÇÃO:</strong> Não nos responsabilizamos pela disponibilidade ou funcionamento 
                        de serviços de terceiros integrados à Plataforma, incluindo mas não limitado a:
                      </p>
                      <ul className="list-disc pl-6 text-red-200/80 text-sm mt-2 space-y-1">
                        <li>WhatsApp / Evolution API</li>
                        <li>Gateways de pagamento</li>
                        <li>Serviços de CEP e logística</li>
                        <li>APIs de terceiros</li>
                      </ul>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">6. Compensações</h3>
                    <p className="text-muted-foreground">
                      Em caso de descumprimento do SLA por mais de 24 horas consecutivas, o Contratante 
                      poderá solicitar crédito proporcional ao período de indisponibilidade, limitado a 
                      30% do valor mensal. <strong>Não há compensações em dinheiro ou reembolsos.</strong>
                    </p>
                  </section>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* LGPD */}
          <TabsContent value="lgpd" className="mt-6">
            <div className="bg-card rounded-xl p-6 shadow-card">
              <ScrollArea className="h-[70vh] pr-4">
                <div className="prose prose-invert max-w-none space-y-6">
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Database className="w-6 h-6 text-primary" />
                    Conformidade com a LGPD
                  </h2>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">1. Papéis e Responsabilidades</h3>
                    <div className="bg-muted/30 rounded-lg p-4 space-y-4">
                      <div>
                        <p className="font-semibold text-foreground">Morphews CRM - Operador de Dados</p>
                        <p className="text-sm text-muted-foreground">
                          Atuamos como OPERADOR dos dados pessoais inseridos pelo Contratante. 
                          Processamos os dados conforme instruções do Contratante e exclusivamente 
                          para prestação dos serviços.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Contratante - Controlador de Dados</p>
                        <p className="text-sm text-muted-foreground">
                          O Contratante atua como CONTROLADOR dos dados de seus clientes/leads. 
                          É responsável por obter consentimento, definir finalidades e garantir 
                          a legalidade do tratamento.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">2. Responsabilidades do Contratante (Controlador)</h3>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                      <p className="text-amber-200 text-sm font-semibold mb-2">
                        O Contratante é INTEGRALMENTE RESPONSÁVEL por:
                      </p>
                      <ul className="list-disc pl-6 text-amber-200/80 text-sm space-y-2">
                        <li>Obter consentimento válido de seus clientes para coleta e tratamento de dados</li>
                        <li>Informar seus clientes sobre como seus dados serão utilizados</li>
                        <li>Garantir base legal para cada tratamento realizado</li>
                        <li>Atender solicitações de titulares (acesso, correção, exclusão)</li>
                        <li>Manter registro das operações de tratamento</li>
                        <li>Notificar incidentes de segurança à ANPD quando aplicável</li>
                        <li>Garantir que mensagens enviadas via WhatsApp estejam em conformidade</li>
                      </ul>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">3. Nossas Obrigações como Operador</h3>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                      <li>Processar dados apenas conforme instruções do Contratante</li>
                      <li>Manter confidencialidade dos dados</li>
                      <li>Implementar medidas técnicas de segurança</li>
                      <li>Auxiliar o Contratante no atendimento a titulares (mediante solicitação)</li>
                      <li>Notificar o Contratante sobre incidentes de segurança</li>
                      <li>Excluir dados após término do contrato (respeitando prazos legais)</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">4. Transferência Internacional</h3>
                    <p className="text-muted-foreground">
                      Os dados podem ser processados em servidores localizados fora do Brasil. 
                      Utilizamos provedores que garantem níveis adequados de proteção de dados, 
                      conforme previsto na LGPD.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold text-foreground">5. Encarregado de Dados (DPO)</h3>
                    <p className="text-muted-foreground">
                      Para questões relacionadas à proteção de dados, entre em contato através do 
                      canal de suporte da plataforma.
                    </p>
                  </section>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Responsabilidades */}
          <TabsContent value="responsabilidades" className="mt-6">
            <div className="bg-card rounded-xl p-6 shadow-card">
              <ScrollArea className="h-[70vh] pr-4">
                <div className="prose prose-invert max-w-none space-y-6">
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Scale className="w-6 h-6 text-primary" />
                    Divisão de Responsabilidades
                  </h2>

                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-200 text-sm font-semibold">
                      LEIA COM ATENÇÃO: Esta seção define claramente as responsabilidades de cada parte. 
                      Ao utilizar a Plataforma, você concorda integralmente com esta divisão.
                    </p>
                  </div>

                  {/* O que é responsabilidade do Cliente */}
                  <section>
                    <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      Responsabilidades do CONTRATANTE
                    </h3>
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                      <ul className="space-y-3 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">1.</span>
                          <span><strong>Backup de Dados:</strong> Realizar backups periódicos através da funcionalidade de exportação. A perda de dados por falta de backup é de responsabilidade exclusiva do Contratante.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">2.</span>
                          <span><strong>Conformidade Legal:</strong> Garantir que o uso da Plataforma está em conformidade com todas as leis aplicáveis, incluindo LGPD, CDC, e regulamentações setoriais.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">3.</span>
                          <span><strong>Consentimento de Clientes:</strong> Obter e manter comprovação de consentimento de todos os clientes/leads cujos dados são inseridos na Plataforma.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">4.</span>
                          <span><strong>Conteúdo das Mensagens:</strong> Todo conteúdo enviado via WhatsApp ou outros canais é de responsabilidade exclusiva do Contratante, incluindo mensagens automáticas.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">5.</span>
                          <span><strong>Segurança de Credenciais:</strong> Manter senhas seguras e não compartilhar credenciais. Qualquer ação realizada com suas credenciais é de sua responsabilidade.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">6.</span>
                          <span><strong>Veracidade dos Dados:</strong> Garantir que todas as informações inseridas são verdadeiras e atualizadas.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">7.</span>
                          <span><strong>Uso da Integração WhatsApp:</strong> Respeitar os Termos de Uso do WhatsApp e da Evolution API. O banimento de números é responsabilidade do Contratante.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">8.</span>
                          <span><strong>Gestão de Equipe:</strong> Configurar corretamente permissões e supervisionar ações de seus usuários.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">9.</span>
                          <span><strong>Decisões de Negócio:</strong> Quaisquer decisões comerciais tomadas com base em dados/relatórios da Plataforma.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 font-bold">10.</span>
                          <span><strong>Treinamento:</strong> Capacitar sua equipe para uso adequado da Plataforma.</span>
                        </li>
                      </ul>
                    </div>
                  </section>

                  {/* O que é nossa responsabilidade */}
                  <section>
                    <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      Nossas Responsabilidades
                    </h3>
                    <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                      <ul className="space-y-3 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 font-bold">✓</span>
                          <span>Manter a infraestrutura operacional conforme SLA</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 font-bold">✓</span>
                          <span>Implementar medidas de segurança técnica</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 font-bold">✓</span>
                          <span>Realizar backups automáticos da infraestrutura</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 font-bold">✓</span>
                          <span>Manter isolamento entre tenants (multi-tenancy)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 font-bold">✓</span>
                          <span>Fornecer suporte técnico conforme SLA</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 font-bold">✓</span>
                          <span>Comunicar atualizações e manutenções</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-500 font-bold">✓</span>
                          <span>Disponibilizar funcionalidade de exportação de dados</span>
                        </li>
                      </ul>
                    </div>
                  </section>

                  {/* Limitação de Responsabilidade */}
                  <section>
                    <h3 className="text-xl font-semibold text-foreground">Limitação de Responsabilidade</h3>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <p className="text-red-200 text-sm mb-4">
                        <strong>EM NENHUMA HIPÓTESE</strong> seremos responsáveis por:
                      </p>
                      <ul className="list-disc pl-6 text-red-200/80 text-sm space-y-2">
                        <li>Danos indiretos, incidentais, especiais ou consequenciais</li>
                        <li>Lucros cessantes ou perda de oportunidades de negócio</li>
                        <li>Perda de dados causada por falta de backup do Contratante</li>
                        <li>Uso inadequado ou ilegal da Plataforma</li>
                        <li>Falhas de serviços de terceiros (WhatsApp, pagamentos, etc.)</li>
                        <li>Banimento de números de WhatsApp por uso inadequado</li>
                        <li>Multas ou penalidades por descumprimento de leis pelo Contratante</li>
                        <li>Decisões de negócio baseadas em dados da Plataforma</li>
                      </ul>
                      <p className="text-red-200 text-sm mt-4">
                        <strong>A responsabilidade máxima</strong> em qualquer caso será limitada ao 
                        valor pago pelo Contratante nos últimos 3 meses.
                      </p>
                    </div>
                  </section>

                  {/* Indenização */}
                  <section>
                    <h3 className="text-xl font-semibold text-foreground">Indenização</h3>
                    <p className="text-muted-foreground">
                      O Contratante concorda em defender, indenizar e isentar a Plataforma de 
                      quaisquer reclamações, danos, perdas, custos e despesas (incluindo honorários 
                      advocatícios) decorrentes de:
                    </p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                      <li>Violação destes Termos pelo Contratante</li>
                      <li>Uso ilegal da Plataforma</li>
                      <li>Violação de direitos de terceiros</li>
                      <li>Reclamações de clientes/leads do Contratante</li>
                    </ul>
                  </section>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
